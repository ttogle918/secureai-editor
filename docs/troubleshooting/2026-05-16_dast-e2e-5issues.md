# DAST E2E 엔드투엔드 5가지 이슈 해결 기록

**날짜**: 2026-05-16  
**브랜치**: `feat/sprint6`  
**관련 커밋**: `18f23c2`, `35adb64`, `ec0e7db`

---

## 이슈 1 — HTTP 500: `/internal/dast/execute` 항상 실패

### 증상
```
backend | ERROR ... 500 Internal Server Error
backend | ERROR ... DataIntegrityViolationException: ...foreign key constraint
```
DAST 실행 버튼을 눌러도 백엔드가 500을 반환. DAST가 단 한 번도 실행되지 않음.

### 원인 분석
**원인 1**: `DastExecutionService.execute()` 안의 `saveInitial()`이 `try` 블록 **바깥**에 있었다.
```java
// 버그 코드
ExploitResult result = exploitResultPersister.saveInitial(vulnId, req);  // try 밖
try {
    containerId = dockerSandboxManager.createAndStart(...);
    ...
} catch (Exception e) {
    saveFailed(result, ...);  // result가 null이거나 FK 위반이면 여기서도 터짐
}
```
`vulnId`가 `vulnerabilities` 테이블에 없으면 FK 위반 → 예외가 try 밖에서 발생 → 500 전파.

**원인 2**: catch 블록 내 `saveFailed()`가 자체적으로 예외를 던지면 원래 DAST 실패 원인을 덮어쓰며 500 전파.

### 해결
```java
// 수정 코드
ExploitResult result;
try {
    result = exploitResultPersister.saveInitial(vulnId, req);  // try 안으로 이동
} catch (Exception e) {
    log.error("DAST initial save failed: vulnType={} error={}", req.vulnType(), e.getMessage());
    return failureResponse("초기 상태 저장 실패: " + e.getMessage(), null);
}

try {
    ...
} catch (Exception e) {
    safelyPersistFailure(result, ScanStatus.FAILED, e.getMessage(), durationMs);  // 래퍼 추가
    log.warn("DAST execution failed: vulnType={} error={}", req.vulnType(), e.getMessage());
    return failureResponse(e.getMessage(), containerId);
}

// safelyPersistFailure: persist 실패가 응답에 영향 없도록 격리
private void safelyPersistFailure(ExploitResult result, ScanStatus status, String message, long durationMs) {
    try {
        exploitResultPersister.saveFailed(result, status, message, durationMs);
    } catch (Exception persistEx) {
        log.error("Failed to persist DAST failure result: {}", persistEx.getMessage());
    }
}
```

---

## 이슈 2 — SSE 이벤트 유실: DAST 완료됐는데 터미널에 결과 안 나옴

### 증상
백엔드 로그에는 DAST 완료 기록이 있고 Redis MONITOR에서 PUBLISH도 확인되는데,
프론트엔드 DastTerminal에 결과가 표시되지 않음.

### 원인 분석
DAST 그래프가 1ms 이내에 완료되는 경우:
```
T=0ms   : 프론트에서 DAST 시작 요청 (fetch POST /dast/start)
T=1ms   : AI Engine이 DAST 실행 → notify_node에서 Redis PUBLISH
T=500ms : 프론트의 EventSource가 SSE 연결 → 이미 PUBLISH는 지나간 상태
```
`PUBLISH`는 pub/sub이라 구독자가 없을 때 보내면 소실됨.

처음에는 `setDastSessionId(dastId)` 호출 위치가 fetch **이후**였다:
```typescript
// 버그 코드
const res = await fetch(...)   // DAST 시작
setDastSessionId(dastId)       // SSE 구독 시작 — 이미 늦을 수 있음
```

### 해결: 3계층 방어

**계층 1 (서버)**: `notify_node.py` — PUBLISH 전에 SETEX로 결과를 Redis 키에 캐시
```python
await r.setex(result_key, 300, message)   # 5분 캐시
await r.publish(channel, message)
```

**계층 2 (서버)**: SSE generator — subscribe 직후 캐시 키를 확인해 이미 결과가 있으면 즉시 반환
```python
await pubsub.subscribe(channel)
cached = await r.get(result_key)
if cached:
    yield f"data: {cached}\n\n"
    return
```

**계층 3 (프론트)**: `setDastSessionId` 호출을 fetch **전**으로 이동 → EventSource 선구독
```typescript
setDastSessionId(dastId)   // 먼저 SSE 구독 열기
const res = await fetch(...)  // 그 다음 DAST 시작
```

---

## 이슈 3 — Windows Docker 소켓: 컨테이너 안에서 Docker 접근 불가

### 증상
```
backend | ERROR Failed to connect to docker: unix:///var/run/docker.sock
```
`docker-compose.yml`에 `/var/run/docker.sock:/var/run/docker.sock` 볼륨 마운트를 해도 Windows에서 실패.

### 원인
Windows Docker Desktop은 WSL2 기반이라 Unix 소켓을 Linux 컨테이너 안으로 마운트하는 것을 지원하지 않는다.

### 해결
Docker Desktop의 TCP API를 활성화:
> Docker Desktop → Settings → General → **"Expose daemon on tcp://localhost:2375 without TLS"** 체크

그리고 `DockerClientConfig.java`가 환경변수를 읽도록 수정:
```java
// 수정 전: 하드코딩
private static final String DEFAULT_DOCKER_HOST = "unix:///var/run/docker.sock";

// 수정 후: 환경변수 우선
String dockerHost = System.getenv().getOrDefault("DOCKER_HOST", DEFAULT_DOCKER_HOST);
```

`docker-compose.yml`에 환경변수 추가:
```yaml
backend:
  environment:
    DOCKER_HOST: tcp://host.docker.internal:2375
```

Linux/Mac은 `DOCKER_HOST` 환경변수가 없으면 Unix 소켓을 기본으로 사용하므로 이식성 유지.

---

## 이슈 4 — DAST 결과 새로고침 후 사라짐

### 증상
DAST를 실행해서 결과(EXPLOITED / DAST 안전 배지)가 표시됐는데,
페이지를 새로고침하거나 로그아웃 후 재로그인하면 배지가 모두 사라짐.

### 원인 분석 (1차 시도 — 실패)
처음에는 `useLoadLatestResults`에 `/dast/results/${latest.id}` 조회를 추가했다.
`latest.id`는 최신 SAST 분석 세션의 ID.

그런데 **항상 0건**이 반환됐다.

로그와 DB를 확인해보니:

| 항목 | 값 |
|------|---|
| SAST 분석 세션 ID (`latest.id`) | `aaaaaaaa-1111-...` |
| `exploit_results.session_id` | `bbbbbbbb-2222-...` |

**두 UUID가 완전히 다르다.**

이유: 프론트에서 DAST 실행 시 `crypto.randomUUID()`로 새 UUID를 생성해서 DAST 세션 ID로 사용하고 있었다.
```typescript
const dastId = crypto.randomUUID()   // DAST 전용 세션 ID
setDastSessionId(dastId)
await fetch(`/dast/start`, { body: JSON.stringify({ sessionId: dastId, ... }) })
```
백엔드는 이 `dastId`를 `exploit_results.session_id`로 저장한다.
`useLoadLatestResults`가 조회하는 SAST 세션 ID와는 전혀 다른 값이다.

### 해결 (2차 시도 — 성공)
세션 ID 대신 **vuln ID**로 조회. vuln ID는 SAST 결과로부터 얻으므로 항상 알 수 있고, 세션 ID와 무관하다.

**백엔드**: bulk vulnId 조회 엔드포인트 추가
```java
// ExploitResultRepository
@Query("SELECT e FROM ExploitResult e WHERE e.vulnId IN :vulnIds AND e.status IN :statuses ORDER BY e.executedAt DESC")
List<ExploitResult> findCompletedByVulnIdIn(@Param("vulnIds") Collection<UUID> vulnIds, @Param("statuses") Collection<ScanStatus> statuses);
```

```java
// DastController
@PostMapping("/dast/results/by-vuln-ids")
public ResponseEntity<ApiResponse<List<DastResultDto>>> getResultsByVulnIds(@RequestBody List<UUID> vulnIds) { ... }
```

**프론트엔드**: 취약점 로드 후 vulnId 목록으로 일괄 조회
```typescript
// useLoadLatestResults.ts
const vulnIds = items.map((v) => v.id);
const dastRes = await apiClient.post<{ data: DastResultItem[] }>(
  '/dast/results/by-vuln-ids',
  vulnIds,
);
for (const r of (dastRes.data ?? [])) {
  if (r.vulnId) setDastExploitResult(r.vulnId, { success: r.success, ... });
}
```

---

## 이슈 5 — 백엔드 로그에 100줄 스택트레이스

### 증상
```
backend | ERROR DAST execution failed: vulnType=SQL_INJECTION error=...
    at io.secureai.backend.domain.dast.service.DastExecutionService.execute(...)
    at io.secureai.backend.domain.dast.service.DastExecutionService$$SpringCGLIB$$0.execute(...)
    at io.secureai.backend.domain.dast.controller.DastController.executeInSandbox(...)
    ... (100줄 이상)
```

### 원인
SLF4J에서 `log.error("message", exception)` — 예외 **객체**를 두 번째 인자로 전달하면 전체 스택트레이스를 출력.

### 해결
```java
// 전: 스택트레이스 100줄
log.error("DAST execution failed: vulnType={} error={}", req.vulnType(), e);

// 후: 단일 라인 WARN
log.warn("DAST execution failed: vulnType={} error={}", req.vulnType(), e.getMessage());
```

DAST 실패는 예상 가능한 상황(Docker 미연결, 네트워크 오류 등)이므로 ERROR가 아닌 WARN이 적절.
운영 환경에서 실제 예외 스택이 필요한 경우는 APM 도구(Sentry 등)로 수집하도록 가이드.

---

## 재현 환경

- Windows 11 + Docker Desktop (WSL2)
- `secureai/dast-runner:latest` 이미지 (`make dast-runner`로 빌드)
- `dast-isolated-net` Docker 네트워크 (`docker network create --internal dast-isolated-net`)
- DVWA 타겟: `docker run -d -p 8888:80 dvwa/dvwa`

## 교훈

1. **DB 저장 트랜잭션은 항상 예외 경계 안에** — 외부 의존성(FK, 네트워크) 호출은 try 블록 안에서만
2. **pub/sub은 구독자 없으면 유실** — 캐시(SETEX) + 구독 후 즉시 캐시 확인으로 보완
3. **같은 "세션"이라는 단어라도 도메인이 다르면 ID가 다르다** — DAST 세션 ID ≠ SAST 분석 세션 ID
4. **Windows Docker는 Unix 소켓 DooD 불가** — 환경변수로 전환 가능하게 설계해야 이식성 확보
