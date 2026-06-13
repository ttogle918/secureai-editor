# ZAP DAST 스캔 하니스 운영 가이드

## 한 줄 요약
`make zap-scan` — baseline 스캔 후 Critical/High 1건 이상이면 exit 1(게이트 차단).

---

## 사전 요구사항

1. Docker 및 Docker Compose 설치
2. 전체 서비스 기동 (`make dev`)
3. `dast-isolated-net` 네트워크 생성 (없으면 아래 명령 실행):
   ```bash
   docker network create dast-isolated-net
   ```

---

## 실행 방법

### Baseline 스캔 (기본)
```bash
make dev        # 서비스 기동 (이미 기동 중이면 생략)
make zap-scan   # ZAP baseline 스캔 + 게이트 집계
```

### Full 스캔 (선택)
```bash
make zap-scan SCAN_TYPE=full
```
Full 스캔은 Spider + Ajax Spider를 포함하며 시간이 더 소요됩니다.

### 스캔 대상 URL 변경
```bash
# HTTPS 엔드포인트 대상
make zap-scan ZAP_TARGET_URL=https://localhost:443

# 외부 스테이징 환경
make zap-scan ZAP_TARGET_URL=https://staging.secureai.example.com
```

### 게이트 단독 실행 (리포트가 이미 있을 때)
```bash
make zap-gate
# 또는
python infra/zap/gate.py infra/zap/reports/zap-report.json
```

---

## 리포트 위치

| 파일 | 설명 |
|------|------|
| `infra/zap/reports/zap-report.html` | 사람이 읽는 HTML 리포트 |
| `infra/zap/reports/zap-report.json` | 게이트 집계용 JSON 리포트 |

> 리포트 파일은 `.gitignore`로 커밋이 차단됩니다. CI 산출물 아카이브나 별도 저장소를 사용하세요.

---

## 게이트 해석

| ZAP Risk Level | riskcode | 게이트 결과 | 설명 |
|---------------|----------|------------|------|
| Critical      | 4        | FAIL (exit 1) | 즉시 수정 필요 |
| High          | 3        | FAIL (exit 1) | 즉시 수정 필요 |
| Medium        | 2        | WARN (exit 0) | 경고, 운영 전 수정 권장 |
| Low           | 1        | WARN (exit 0) | 개선 권장 |
| Informational | 0        | IGNORE (exit 0) | 참고 정보 |

**baseline.py PASS/WARN/FAIL 매핑:**
- `PASS` : 탐지된 alert 없음 → exit 0
- `WARN` : Medium 이하만 탐지 → exit 0 (게이트 통과, 결과 리포트 포함)
- `FAIL` : High/Critical 탐지 → exit 1 (게이트 차단)

---

## 룰 튜닝

오탐(False Positive)이 발생하면 `infra/zap/rules.tsv`에서 룰 등급을 조정합니다:

```tsv
# 형식: <ruleId>\t<IGNORE|WARN|FAIL>\t<설명>
10016	IGNORE	이미 Nginx에서 관리하는 헤더
```

ZAP 룰 ID는 리포트 HTML의 "Alert" 섹션에서 확인합니다.

---

## 네트워크 격리 구조

```
┌─────────────────────────────────────────────────────┐
│  app-net (backend ↔ frontend ↔ nginx)               │
│  data-net (backend ↔ postgres, redis)               │
│                                                     │
│  dast-isolated-net                                  │
│  ┌─────────┐       ┌──────────────────────────┐    │
│  │  ZAP    │──────▶│  nginx (공개 엔드포인트)  │    │
│  └─────────┘       └──────────────────────────┘    │
│                                                     │
│  postgres, redis — dast-isolated-net에 없음         │
│  → ZAP가 DB에 직접 접근 불가 (격리 보장)            │
└─────────────────────────────────────────────────────┘
```

`dast-isolated-net`은 `external: true`로 호스트 Docker 데몬이 직접 관리합니다.
ZAP는 이 네트워크에서만 동작하므로 `data-net`의 postgres/redis에 도달할 수 없습니다.

---

## 트러블슈팅

| 증상 | 원인 | 해결 |
|------|------|------|
| `dast-isolated-net 없음` | 네트워크 미생성 | `docker network create dast-isolated-net` |
| ZAP 컨테이너가 대상에 연결 못함 | nginx가 기동 중이지 않음 | `make dev` 후 재시도 |
| `gate.py` — `파일을 찾을 수 없습니다` | 스캔이 리포트 생성 전 실패 | ZAP 컨테이너 로그 확인: `docker logs secureai-zap` |
| High 오탐 | 개발 환경 특성 | `infra/zap/rules.tsv`에서 해당 ruleId IGNORE 등록 |

---

## CI 연동 (TASK-1203 예정)

`make zap-scan`은 exit code를 반환하므로 GitHub Actions에서 직접 사용 가능합니다:
```yaml
- name: ZAP DAST Scan
  run: make zap-scan ZAP_TARGET_URL=http://localhost:80
```
exit 1 시 워크플로우가 자동으로 실패합니다.
