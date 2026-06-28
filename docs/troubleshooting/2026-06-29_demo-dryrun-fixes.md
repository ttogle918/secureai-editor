# 데모 드라이런 버그 수정 — DAST·Report·SecurityDoc 파이프라인

**날짜**: 2026-06-29
**브랜치**: `main`
**관련 커밋**: `6251f4b`, `6fa590d`, `2ea52c5`, `4dd61de`, `3b621b2`

---

## 이슈 1 — DAST 배치 취약점 EXPLOITED 미표기

### 증상
격리망(dast-isolated-net) 배치 실행 시 `CROSS_SITE_SCRIPTING /greet` 항목이 "안전"으로 표기됨. 하지만 executor 직접 테스트(vuln_type='XSS')는 EXPLOITED로 정상 작동.

### 원인 분석
SAST 분류기(Claude 모델)가 동일 취약점을 가변적으로 "XSS" 또는 "CROSS_SITE_SCRIPTING"으로 라벨함.
`apps/ai_engine/agent/nodes/dast/dast_runner.py`의 `_EXECUTOR_MAP` 딕셔너리에는 "XSS" 키만 존재했고, 
"CROSS_SITE_SCRIPTING" 키는 누락되어 unsupported 처리 → success=false 반환.

**추가 함정**: Git Bash에서 docker-compose 실행 시 `-e DAST_ENDPOINT=/greet`의 `/greet`를 MSYS 자동 경로변환으로 `C:/Program Files/Git/greet`로 왜곡. 
이로 인해 잘못된 false 신호를 추가로 마주침. (후속 테스트는 `MSYS_NO_PATHCONV=1`로 해결)

### 해결
`_EXECUTOR_MAP`에 별칭 추가:
```python
_EXECUTOR_MAP = {
    "XSS": "execute_xss",
    "CROSS_SITE_SCRIPTING": "execute_xss",  # 별칭 추가
    "IDOR": "execute_idor",
    "BROKEN_ACCESS_CONTROL": "execute_idor",  # 별칭 추가
    ...
}
```
dast-runner 도커 이미지 재빌드 후, 백엔드 `/internal/dast/execute` 직접 호출로 success=true 검증, 
UI 라이브 배치에서 EXPLOITED 배지 확인.

### 관련 커밋
`6251f4b` fix(dast): _EXECUTOR_MAP에 vuln_type 별칭 추가(CROSS_SITE_SCRIPTING→execute_xss, BROKEN_ACCESS_CONTROL→execute_idor)

---

## 이슈 2 — 배치 DAST SSE 스트림 연결 실패

### 증상
프론트엔드 BATCH DAST LOG 탭에 다음 에러 메시지:
```
[SSE] Connection error
배치 DAST 스트림 연결 실패
```
배치 진행 로그가 실시간 수신되지 않음.

### 원인 분석
DAST 배치 로그는 SSE(Server-Sent Events) 연결로 프론트에 스트리밍됨. 
프론트가 ai_engine(`NEXT_PUBLIC_AI_ENGINE_URL` 환경변수 또는 기본값 localhost:8000)에 직접 연결하려 했으나:
- docker-compose.yml에서 ai_engine이 localhost:8000에만 listen 중이었고, host 포트 8000 publish 설정 누락
- 동시에 fastapi-vuln-sample이 호스트 포트 8000을 점유 중

### 해결
docker-compose.yml 수정:
```yaml
ai_engine:
  ports:
    - "8000:8000"  # host 8000 publish 추가
fastapi-vuln:
  ports:
    - "5000:5000"  # 기존 host 포트 변경
```
이미지 재빌드·재시작 후 SSE 200 OK 확인.

### 관련 커밋
`6fa590d` (이전 연속 작업) ai_engine host 8000 publish=SSE

---

## 이슈 3 — 규제 문서 생성 타임아웃 및 status PENDING 고착

### 증상
규제 문서(ISMS-P, CISO 등) 생성 버튼 클릭 후 프론트 UI에 "생성 중…" → "문서 생성 시간이 초과되었습니다" 메시지.
DB `security_doc_requests` 테이블의 행들이 모두 `status='PENDING'` 상태로 고착.
백엔드 로그에 `[SecDocProcessor] 요청을 찾을 수 없음` 메시지 반복.

### 원인 분석
`SecurityDocService.createRequest()`가 `@Transactional` 트랜잭션 내에서 **커밋 전**에 
`asyncProcessor.process()`를 호출하는 구조였음:

```java
@Transactional
public void createRequest(...) {
    SecurityDocRequest req = new SecurityDocRequest(...);
    repository.save(req);  // 아직 커밋 안 됨
    asyncProcessor.process(req);  // @Async 스레드 시작
}
// 여기서 커밋
```

@Async 스레드(secDocExecutor)의 `process()` 메서드 안에서 `findById(req.getId())`를 호출하면, 
원 트랜잭션이 아직 커밋하지 않았으므로 행을 찾을 수 없음 → ConcurrentModificationException or NoSuchElement → 상태 PENDING 고착.
프론트 폴링이 계속 PENDING을 만나다 타임아웃.

### 해결
`ReportService`에 이미 존재하던 `TransactionSynchronization.afterCommit` 패턴을 동일 적용.
`SecurityDocService`를 다음과 같이 수정:

```java
@Transactional
public void createRequest(...) {
    SecurityDocRequest req = new SecurityDocRequest(...);
    repository.save(req);
    
    // 커밋 후 async 트리거
    TransactionSynchronization.registerSynchronization(
        new TransactionSynchronizationAdapter() {
            @Override
            public void afterCommit() {
                asyncProcessor.process(req);
            }
        }
    );
}
```

이 패턴으로 커밋 후에 async 스레드가 시작되므로 `findById`가 성공함. 
테스트: CISO 문서 요청 → PENDING → PROCESSING → COMPLETED 정상 진행 확인.

### 관련 커밋
`4dd61de` fix(report): 규제 문서 @Async 트리거를 트랜잭션 커밋 후(afterCommit)로 이동

---

## 이슈 4 — 규제 문서 afterCommit 수정 후 LazyInitializationException

### 증상
이슈3 수정 후 재시도 시:
- status PENDING은 벗어남 (이슈3 해결)
- 하지만 final status = FAILED, error_message = "Could not initialize proxy [Project#...] - no session"

### 원인 분석
이슈3의 afterCommit 수정으로 async 스레드가 정상 시작되었으나, 
`SecurityDocAsyncProcessor.process()` 메서드(line ~188) 내에서 `req.getProject().getName()`을 호출할 때 
LazyInitializationException 발생.

원인: @Async 스레드는 원 트랜잭션의 영속성 컨텍스트(EntityManager session)를 공유하지 않음.
프록시 객체(Project)가 lazy loaded되려 하는데 session이 없어 실패.

```java
// SecurityDocAsyncProcessor.process()
public void process(SecurityDocRequest req) {
    String projectName = req.getProject().getName();  // ← LazyInitializationException
    ...
}
```

### 해결
`SecurityDocRequestRepository`에 JOIN FETCH 쿼리 메서드 추가:

```java
@Query("SELECT r FROM SecurityDocRequest r "
       + "JOIN FETCH r.project p "
       + "WHERE r.id = :id")
Optional<SecurityDocRequest> findWithProjectById(@Param("id") Long id);
```

`SecurityDocAsyncProcessor.process()`가 이 메서드를 사용하도록 변경.
그러면 req.getProject()가 이미 eager-loaded되어 session 없어도 접근 가능.

테스트: CISO 문서 요청 재시도 → PENDING → PROCESSING → COMPLETED 확인, 
error_message 없음.

### 관련 커밋
`3b621b2` fix(report): 규제 문서 비동기 생성 시 project LazyInitializationException 해결(findWithProjectById JOIN FETCH)

---

## 이슈 5 — 리포트(보고서) 생성 시 취약점 중복 표기

### 증상
생성한 PDF 보고서에 "Total Vulnerabilities = 414"로 표기됨.
하지만 실제 샘플(demo-vuln-sample, 5개 파일)은 단일 세션에 19건의 취약점만 보유.
414 = 프로젝트 누적 모든 세션의 취약점 수(demo-vuln-sample이 여러 번 실행된 누적).

### 원인 분석
리포트 생성 플로우:
1. 프론트 /api/reports/generate 호출 시 sessionId를 path/query 파라미터로 전달
2. 백엔드 `ReportAsyncProcessor.loadVulnerabilities(sessionId)` 호출
3. sessionId가 null일 때(프론트 페이지 리로드로 컨텍스트 유실) 
   `repository.findByProjectId(projectId)` 호출 → **프로젝트의 모든 세션 누적** 반환

```java
public List<Vulnerability> loadVulnerabilities(Long projectId, Long sessionId) {
    if (sessionId == null) {
        return repository.findByProjectId(projectId);  // ← 누적 반환
    }
    return repository.findBySessionId(sessionId);
}
```

### 해결
sessionId null일 때 프로젝트의 **최신 세션**으로 폴백:

```java
public List<Vulnerability> loadVulnerabilities(Long projectId, Long sessionId) {
    if (sessionId == null) {
        Optional<Session> latestSession = sessionRepository
            .findTopByProjectIdOrderByCreatedAtDesc(projectId);
        if (latestSession.isPresent()) {
            sessionId = latestSession.get().getId();
        }
    }
    return repository.findBySessionId(sessionId);
}
```

테스트: 리포트 생성 후 PDF 확인 → Total Vulnerabilities = 19 (최신 세션만) 정상.

### 관련 커밋
`2ea52c5` fix(report): 세션 미지정 리포트는 프로젝트 전체(414건 중복) 대신 최신 세션으로 폴백

---

## 복합 영향

이 5개 버그는 데모 드라이런 시 연쇄적으로 발생:

1. **DAST 별칭 부재**(이슈1) → XSS 취약점이 EXPLOITED로 표기 안 됨 → 데모 클라이맥스 표현 약화
2. **SSE 연결 실패**(이슈2) → 배치 실시간 로그 불가 → UX 답답함
3. **규제 문서 타임아웃·고착**(이슈3) → 제2막 규제 준수 현황 표시 안 됨
4. **LazyInitializationException**(이슈4) → 이슈3 수정 후 부작용
5. **리포트 중복**(이슈5) → 보고서 결과 신뢰도 하락

모두 해결 후 풀 드라이런(씬1~씬7) 정상 실행 확인.
