# 부하 테스트 (k6)

## 사전 요구사항
- Docker 및 Docker Compose 설치
- 전체 서비스 기동 상태 (`make dev`)

## 실행 방법

### make 명령어 사용 (권장)
```bash
# 전체 서비스를 먼저 기동한 뒤
make dev

# k6 부하 테스트 실행
make perf-test
```

### docker compose 직접 실행
```bash
docker compose --profile perf run --rm k6 run /scripts/load-test.js
```

### 로컬 k6 바이너리 사용 (k6 설치 필요)
```bash
BASE_URL=http://localhost:8080 k6 run tests/perf/load-test.js
```

## 테스트 시나리오 (`load-test.js`)

| 단계 | 시간 | VU 수 | 설명 |
|------|------|--------|------|
| 워밍업 | 30s | 0 → 20 | 서버 워밍업 |
| 부하 | 1m | 20 → 100 | 주요 부하 구간 |
| 쿨다운 | 30s | 100 → 0 | 트래픽 감소 |

## 합격 기준 (Thresholds)

- `p(95) < 500ms`: 95번째 백분위 응답시간 500ms 미만
- `errors < 1%`: 에러율 1% 미만

## 결과 확인

테스트 완료 후 `tests/perf/results.json`에 상세 결과가 저장됩니다.

```bash
# 결과 파일 확인
cat tests/perf/results.json
```

## 환경 변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `BASE_URL` | `http://secureai-backend:8080` | 테스트 대상 백엔드 URL |
