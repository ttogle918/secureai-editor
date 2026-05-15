# [2026-05-16] 작업 세션 요약

**브랜치**: `feat/sprint6`
**작업 범위**: Sprint 6 Stage 1–2 완료 — DAST Docker 샌드박스 + LangGraph 에이전트 + pgvector 임베딩

---

## 1. 완료 작업

| 항목 | 주요 파일 |
|------|---------|
| Stage 1: Python 익스플로잇 실행기 5종 | `executors/{sqli,xss,idor,ssrf,auth_bypass}_executor.py`, `dast_runner.py` |
| Stage 1: Java Docker 샌드박스 | `DockerSandboxManager.java`, `ContainerConfig.java`, `DockerClientConfig.java` |
| Stage 1: 도메인 검증 + Rate Limit | `DomainVerificationService.java`, `DistributedLockService.java`, `ScanTarget.java` |
| Stage 1: 엔티티 + Flyway | `ExploitResult.java`, `ScanStatus.java`, V026, V027 |
| Stage 2: DAST LangGraph 그래프 | `dast_node.py`, `notify_node.py`, `docker_tool.py`, `after_dast.py`, `dast_graph_builder.py` |
| Stage 2: DAST REST 레이어 | `DastController.java`, `DastExecutionService.java`, `ExploitResultPersister.java`, `DastResultHandler.java` |
| Stage 2: pgvector 임베딩 (FEAT-SEC-006) | `embedding_service.py`, `guidelines_client.py` 수정, `sync_guidelines.py`, V028 |
| 단위 테스트 | Backend 42개 + Python 21개 (전부 통과) |
| PR 생성 | [PR #70](https://github.com/ttogle918/secureai-editor/pull/70) |

---

## 2. 의논 내용 & 결정 맥락

### Flyway 버전 번호 사전 보정
V008/V011이 이미 다른 마이그레이션에 사용 중임을 착수 전에 발견.
V026 (dast_results), V027 (scan_targets), V028 (pgvector) 로 조정했다.

### dnsjava 대신 JDK JNDI 선택
`org.xbill.dns:dnsjava:3.6.1`을 `repo.spring.io/release`에서 resolve 시 401 오류 발생.
외부 의존성 없이 JDK 내장 `InitialDirContext` + `com.sun.jndi.dns.DnsContextFactory`로 DNS TXT 조회를 구현했다.

### Docker Java SDK 3.3.x API 변경 대응
`DockerClientBuilder.getInstance(String)` 생성자가 3.3.x에서 제거됨.
`DockerClientImpl.getInstance(DefaultDockerClientConfig, ApacheDockerHttpClient)` 패턴으로 교체했다.

### DockerClient DIP 위반 → Reviewer 지적으로 수정
초기 구현에서 `DockerSandboxManager`가 `DockerClient`를 내부에서 직접 생성했음.
Reviewer가 DIP 위반으로 지적 → `DockerClientConfig.java` `@Configuration`으로 `@Bean` 추출,
`@RequiredArgsConstructor`로 주입하도록 변경했다.

### Shell Injection 취약점 → Reviewer 지적으로 수정
`DastExecutionService.buildCommand()`에서 `req.targetUrl()`을 `String.format`으로 Python
인라인 스크립트에 삽입했던 구조가 Shell Injection 위험을 내포함.
수정 방향: 정적 Python 스크립트에서 `os.environ`으로 읽도록 변경하고,
사용자 입력은 Docker 환경변수(`DAST_VULN_TYPE`, `DAST_ENDPOINT`, `DAST_TARGET_URL`, `DAST_PARAMS`)로 분리 전달.

### DastController Repository 직접 의존 → Reviewer 지적으로 수정
Controller가 `ExploitResultRepository`를 직접 주입하여 `getResults` 조회에 사용했음.
`DastExecutionService.getResultsBySessionId()`로 이동하고 Controller는 Service를 경유하도록 수정했다.

### pgvector 임베딩 — fastembed 선택 이유
OpenAI/Voyage 임베딩은 추가 API 키 필요. fastembed는 ONNX 기반으로 API 키 없이
로컬에서 실행 가능한 `BAAI/bge-small-en-v1.5` (384차원)를 사용한다.
기존 `load_guidelines(target_stack)` 시그니처를 유지하면서 `search_guidelines_by_vuln_type()`을
additive하게 추가하여 SAST 파이프라인에 영향을 주지 않았다.

### Mockito strict mode 대응 (lenient 스텁)
`@BeforeEach`에서 `redisTemplate.opsForValue()` 스텁이 일부 테스트에서 불필요해
`UnnecessaryStubbingException` 발생. `lenient().when()` 패턴으로 해결했다.

---

## 3. 버그 수정 / 특이사항

| 버그 | 원인 | 해결 |
|------|------|------|
| `awaitStatusCode(Duration)` 컴파일 오류 | `WaitContainerResultCallback`은 Duration 미지원 | `awaitStatusCode(long, TimeUnit.SECONDS)` 로 변경 |
| `ExploitResult.status`가 String 타입 | 초기 구현 누락 | `@Enumerated(EnumType.STRING) ScanStatus status` 로 수정 |
| `targetUrl`, `payload`, `responseSnippet` 미암호화 | Reviewer ADR-009 지적 | `@Convert(converter = AesEncryptionConverter.class)` 추가 |
| `DastResultHandlerTest` XML 파싱 오류 (Windows BOM) | PowerShell XML 파싱 이슈 | Bash `grep`으로 우회, 실제 테스트는 정상 통과 |

---

## 4. 다음 세션에서 할 것

- [ ] **TASK-604**: `DastTerminal.tsx` 실시간 SSE 스트리밍 + ANSI 컬러 + 익스플로잇 뱃지
- [ ] **통합 테스트 환경 구성**: `make infra` + `docker network create dast-isolated-net`
- [ ] **Flyway 마이그레이션 확인**: V026~V028 정상 적용 확인
- [ ] **DVWA 시연**: `docker run -d -p 8888:80 dvwa/dvwa` 후 실제 DAST 시연
- [ ] **PR #70 merge**: feat/sprint6 → main (사용자가 직접 수행)
- [ ] **Sprint 5 이월 TASK-501~505**: Sprint 6 완료 후 Sprint 7에서 처리

### 수동 검증 체크리스트 (인프라 필요)
```
make infra
docker network create dast-isolated-net
# Flyway V026~V028 마이그레이션 확인
# 컨테이너 격리 테스트: dast-isolated-net 외부 접근 차단 확인
# Docker Socket 마운트 없음 확인
# Rate Limit: 동일 도메인 4회 요청 → 429 확인
# 분산 락: 동시 요청 → 409 확인
```
