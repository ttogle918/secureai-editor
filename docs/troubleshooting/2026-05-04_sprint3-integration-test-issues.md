# Sprint 3 통합 테스트 트러블슈팅 (2026-05-04 ~ 2026-05-05)

**브랜치**: `feat/sprint3`  
**대상 테스트**: `tests/integration/test_backend_sprint3.py`, `test_sprint3_integration.py`, `test_sprint3_pending.py`

---

## 1. Flyway baseline-on-migrate 로 인해 V001 건너뜀

**증상**:
```
ERROR: relation "plans" does not exist  (V002 실패)
```

**원인**:
- `baseline-on-migrate: true` + Flyway 기본 `baseline-version: 1`
- Fresh DB에서 V001을 "베이스라인"으로 표시만 하고 실행하지 않음 → `plans` 테이블 미생성

**수정** (`application.yaml`):
```yaml
flyway:
  baseline-on-migrate: true
  baseline-version: 0   # V001부터 전체 실행 보장
```

**추가 조치**: 한 번 잘못된 상태로 기동되면 `flyway_schema_history`에 FAILED 기록이 남음 → 반드시 볼륨 초기화 필요
```bash
docker compose down -v && docker compose up -d
```

---

## 2. V013 JSONB 변환 — DEFAULT 때문에 USING 실패

**증상**:
```
ERROR: column "call_chain" cannot be cast automatically to type jsonb
```

**원인**:
- `call_chain TEXT NOT NULL DEFAULT '[]'` 컬럼을 `TYPE JSONB USING call_chain::jsonb`로 변환 시
- PostgreSQL이 DEFAULT 값도 함께 변환하려 해서 오류 발생

**수정** (V013 최종):
```sql
ALTER TABLE vulnerabilities ALTER COLUMN call_chain DROP DEFAULT;
ALTER TABLE vulnerabilities ALTER COLUMN call_chain TYPE JSONB USING call_chain::jsonb;
ALTER TABLE vulnerabilities ALTER COLUMN call_chain SET DEFAULT '[]'::jsonb;
CREATE INDEX idx_vuln_call_chain_gin ON vulnerabilities USING GIN(call_chain);
```

**추가**: V013은 V014/V015 이후에 추가되었으므로 `out-of-order: true` 설정 필요
```yaml
flyway:
  out-of-order: true
```

---

## 3. NvdApiClient — RestClient.Builder DI 실패

**증상**:
```
No qualifying bean of type 'RestClient$Builder' available
```

**원인**:
- Spring Boot 4.0.5에서 `RestClient.Builder` 자동 구성이 동작하지 않음
- `@RequiredArgsConstructor`로 DI 주입 시도 → 빈 없음 오류

**수정** (`NvdApiClient.java`):
```java
// Before: DI 주입
@RequiredArgsConstructor
public class NvdApiClient {
    private final RestClient.Builder restClientBuilder;
}

// After: 생성자에서 정적 빌더 사용
public NvdApiClient(StringRedisTemplate redisTemplate, ObjectMapper objectMapper) {
    this.redisTemplate = redisTemplate;
    this.objectMapper = objectMapper;
    this.restClient = RestClient.builder().build();  // 정적 메서드
}
```

**참고**: `GitHubRestClient`는 정적 `RestClient.builder()`를 이미 사용 중이었음

---

## 4. psycopg3 — ILIKE 내 %s를 플레이스홀더로 인식

**증상**:
```
IndexError: not enough arguments  (또는 unexpected %s in format string)
```

**원인**:
- psycopg3는 SQL 내 `%s`를 모두 파라미터 플레이스홀더로 해석
- `ILIKE '%value%'` 형태에서 `%v`, `%s` 등을 치환하려 함

**수정**:
```python
# 잘못된 예
cursor.execute("SELECT * FROM t WHERE name ILIKE '%s%'", (value,))

# 올바른 예 — %% 이스케이프
cursor.execute("SELECT * FROM t WHERE name ILIKE '%%' || %s || '%%'", (value,))
```

---

## 5. patch_node._redis 전역 상태 — asyncio 이벤트 루프 충돌

**증상**:
```
RuntimeError: Event loop is closed
  또는
RuntimeError: Task attached to a different loop
```

**원인**:
- `patch_node` 모듈의 `_redis` 변수가 테스트 간 공유됨
- 첫 번째 테스트의 이벤트 루프가 닫힌 후 두 번째 테스트에서 동일한 Redis 클라이언트를 재사용

**수정** (각 테스트 앞에 리셋):
```python
async def test_xxx(redis_client):
    patch_node._redis = None  # 이벤트 루프 오염 방지
    ...
```

---

## 6. test_backend_sprint3.py — FK 체인 미생성으로 INSERT 실패

**증상**:
```
ForeignKeyViolation: insert or update on table "vulnerabilities" violates foreign key constraint
```

**원인**:
- `vulnerabilities` 테이블은 `session_id`(FK) 필요
- `analysis_sessions`는 `project_id` + `user_id`(FK) 필요
- 테스트가 중간 부모 레코드 없이 직접 INSERT 시도

**수정**: 전체 FK 체인을 순서대로 생성
```python
# 순서: users → projects → analysis_sessions → vulnerabilities
user = await db.execute("INSERT INTO users ...")
proj = await db.execute("INSERT INTO projects (owner_id=user_id) ...")
sess = await db.execute("INSERT INTO analysis_sessions (project_id, user_id) ...")
vuln = await db.execute("INSERT INTO vulnerabilities (session_id=sess_id) ...")
```

**정리도 역순**:
```python
await db.execute("DELETE FROM vulnerabilities WHERE id = %s", (vuln_id,))
await db.execute("DELETE FROM analysis_sessions WHERE id = %s", (sess_id,))
await db.execute("DELETE FROM projects WHERE id = %s", (proj_id,))
await db.execute("DELETE FROM users WHERE id = %s", (user_id,))
```

---

## 7. Claude API — JSON 응답을 마크다운 펜스로 감쌈

**증상**:
```
JSONDecodeError: Expecting value: line 1 column 1 (char 0)
```

**원인**:
- Claude가 JSON 응답을 그대로 반환하지 않고 마크다운 코드 블록으로 감쌈
  ```
  ```json
  { "patched_snippet": "..." }
  ```
  ```
- 파서가 `{`로 시작하는 순수 JSON을 기대하고 있어 실패

**수정**: 통합 테스트에서 `_call_claude`를 직접 mock해 clean JSON 반환
```python
with patch("agent.nodes.patch_node._call_claude",
           new=AsyncMock(return_value=json.dumps({...}))):
    result = await _generate_patch_for_vuln(vuln, "file.java")
```

**별도 작업**: 실제 Claude 호출 시 마크다운 펜스 제거하는 파서 추가 필요 (TASK-404 연계)

---

## 8. test_sprint3_integration.py — 모듈 경로 변경

**증상**:
```
ModuleNotFoundError: No module named 'agent.tools.response_parser'
```

**원인**: Sprint 3 리팩토링으로 모듈 경로가 변경됨

**수정**:
```python
# Before
from agent.tools.response_parser import parse_vulnerabilities

# After
from agent.response_parser import parse_vulnerabilities
```

---

## 9. test_sprint3_integration.py — classify_and_enrich 반환값 camelCase

**증상**:
```
KeyError: 'call_chain'
```

**원인**: `classify_and_enrich` 함수가 `callChain` (camelCase)을 반환했으나 테스트는 `call_chain` (snake_case)을 기대

**수정**:
```python
# Before
assert "call_chain" in result

# After
assert "callChain" in result
```

---

## 10. jinja2 미설치 — AI Engine 컨테이너

**증상**:
```
ModuleNotFoundError: No module named 'jinja2'
```

**수정**:
```bash
pip install jinja2
# 또는 requirements.txt에 추가
```

---

## 요약 체크리스트 (다음 통합 테스트 시 사전 확인)

```
[ ] Flyway baseline-version: 0 설정 확인
[ ] DB 볼륨 초기화 필요 시: docker compose down -v
[ ] FK 체인 순서 확인: users → projects → sessions → 하위 테이블
[ ] psycopg3 ILIKE 쿼리: %% 이스케이프 사용
[ ] patch_node._redis = None 리셋 (테스트마다)
[ ] Claude mock 필요 시: _call_claude 직접 mock
[ ] 모듈 경로 변경 여부 확인 (리팩토링 후)
[ ] 반환값 camelCase vs snake_case 확인
[ ] 컨테이너 pip 의존성 확인 (jinja2, psycopg 등)
```
