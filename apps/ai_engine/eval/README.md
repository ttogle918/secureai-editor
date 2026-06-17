# SecureAI SAST 평가 하니스

> **풀런 예상 비용: ~$5–15 USD (2,740 케이스, claude-sonnet-4-5)**
> **풀런 예상 시간: ~2–4시간 (순차 실행, rate limit 포함)**

이 디렉터리는 SecureAI SAST 엔진의 탐지 정확도를 **정량 측정**하는 독립 평가 하니스 모음입니다.  
평가 코드는 운영 코드(`agent/`)를 **읽기 전용으로만** 호출하며, 어떠한 프로덕션 파일도 수정하지 않습니다.

---

## 결과 요약 (VAL-1 기준선)

> 이 섹션은 `make eval` 풀런 후 채워집니다.
>
> | 지표 | 값 |
> |------|-----|
> | 탐지율 (Recall/TPR) | TBD |
> | 오탐률 (FPR) | TBD |
> | OWASP Score (TPR−FPR) | TBD |
> | FPR at Recall 80% | TBD |
> | 총 케이스 | 2,740 |
> | 사용 모델 | claude-sonnet-4-5 |
> | 실행일 | TBD |
> | 소요 시간 | TBD |
> | 추정 비용 | TBD |

---

## 디렉터리 구조

```
eval/
├── README.md                      # 이 파일 — 재실행법·비용·숫자
├── results/
│   └── latest.json                # 최신 실행 결과 (자동 생성)
└── owasp_benchmark/
    ├── __init__.py
    ├── fetch.sh                   # BenchmarkJava 클론 스크립트
    ├── runner.py                  # 평가 실행 하니스
    ├── scorer.py                  # 혼동행렬·지표 계산 (순수 함수)
    └── BenchmarkJava/             # 데이터셋 (fetch.sh로 생성)
```

---

## 하니스 목록

| 하니스 | 경로 | 목적 |
|--------|------|------|
| **OWASP Benchmark** | `owasp_benchmark/` | OWASP BenchmarkJava (~2,740 케이스) TPR/FPR/Score |
| *(VAL-7 예정)* | `cve/` | 실제 CVE 재현 벤치 |
| *(VAL-10 예정)* | `stability/` | 결정성/안정성 (Jaccard) |

---

## OWASP Benchmark 하니스 (VAL-1)

### 전제 조건

- Python 3.12+, `anthropic` SDK 설치 (`requirements.txt`)
- `ANTHROPIC_API_KEY` 환경변수 설정 (`.env` 또는 셸)
- git 설치 (fetch.sh용)

### 1단계: 데이터셋 fetch

```bash
bash apps/ai_engine/eval/owasp_benchmark/fetch.sh
# 또는
make eval-fetch
```

약 200MB. 최초 1회만 실행. 이후 재실행 시 이미 존재하면 자동 스킵.

### 2단계: 평가 실행

```bash
# 빠른 샘플 (카테고리별 최대 10건 — ~110 케이스, ~$0.5 USD, ~10분)
make eval LIMIT=10

# 개발 검증 (카테고리별 최대 100건 — ~수백 케이스, ~$1–3 USD, ~30분)
make eval LIMIT=100

# 풀런 (야간/릴리스 게이트 — 2,740 케이스, ~$5–15 USD, ~2–4시간)
make eval
```

### 3단계: 결과 확인

```
stdout: recall=0.XXXX fpr=0.XXXX score=0.XXXX (tp=N fp=N tn=N fn=N total=N)
파일:   apps/ai_engine/eval/results/latest.json
```

`latest.json` 스키마:

```json
{
  "total": 2740,
  "tp": N, "fp": N, "tn": N, "fn": N,
  "recall": 0.XXXXX,
  "fpr": 0.XXXXX,
  "score": 0.XXXXX,
  "precision": 0.XXXXX,
  "f1": 0.XXXXX,
  "fpr_at_recall80": 0.XXXXX,
  "model": "claude-sonnet-4-5",
  "elapsed_s": N.NN,
  "cost_usd_est": N.NNNN,
  "benchmark_tag": "v1.2beta",
  "by_category": { "sqli": {...}, "xss": {...}, ... }
}
```

---

## 채점 방식

OWASP Benchmark 공식 채점을 따릅니다:

```
score = TPR − FPR
TPR   = TP / (TP + FN)  (Recall)
FPR   = FP / (FP + TN)
```

- `score > 0`: 무작위 추측보다 나음
- `score = 1`: 완벽한 탐지
- `score = 0`: 무작위 추측과 동일

추가로 `recall 80%에서의 FPR` (FIXED_RECALL_THRESHOLD=0.8)을 보고합니다.

---

## 비용·시간 추정 (claude-sonnet-4-5 기준)

| 실행 모드 | 케이스 수 | 예상 비용 | 예상 시간 |
|-----------|-----------|-----------|-----------|
| `LIMIT=10` (빠른 샘플) | ~110 | ~$0.3–0.5 | ~5–10분 |
| `LIMIT=100` (개발용) | ~수백 | ~$1–3 | ~20–40분 |
| 풀런 | ~2,740 | ~$5–15 | ~2–4시간 |

> 비용은 Redis 캐시 히트율에 따라 크게 낮아질 수 있습니다.  
> Redis 캐시(7일 TTL)가 활성화된 환경에서 재실행 시 거의 무료입니다.

---

## vuln_type ↔ CWE 매핑

`scorer.VULN_TYPE_TO_CWE` 딕셔너리 (상수화):

| Category | CWE |
|----------|-----|
| cmdi | CWE-78 |
| crypto | CWE-327 |
| hash | CWE-328 |
| ldapi | CWE-90 |
| pathtraver | CWE-22 |
| securecookie | CWE-614 |
| sqli | CWE-89 |
| trustbound | CWE-501 |
| weakrand | CWE-330 |
| xpathi | CWE-643 |
| xss | CWE-79 |

---

## 단위 테스트 실행

```bash
cd apps/ai_engine
pytest tests/eval/test_owasp_scorer.py -v
pytest tests/eval/test_owasp_runner.py -v
```

---

## VAL-2 — CI 회귀 게이트 (eval-check)

### 개요

`check_regression.py`는 `baseline.json` 대비 `latest.json`의 score/recall/fpr 하락폭을 감시합니다.
LLM 미사용(순수 JSON 비교, 비용 0, 결정론적). CI에서 매 PR마다 실행되지만, **`latest.json`은 생성물이라 커밋하지 않으므로**(`eval/results/` 는 `.gitignore`) 게이트는 **그 실행에서 `latest.json`이 새로 생성된 경우에만 실효**합니다. 일반 PR(API 키 없음)에서는 `latest.json` 부재로 graceful no-op.

### 동작 방식

- 하락폭 임계: **−2%p (0.02)** (score·recall·fpr 각각 적용)
- 임계 초과 하락 → GitHub Actions `::warning::` 어노테이션 출력 (비차단, 초기 정책)
- baseline 또는 latest 없으면 graceful 안내 후 exit 0 (게이트 미적용)
- 추후 blocking 전환: `check_regression.py` 상단 주석 참조

### 로컬 실행

```bash
# baseline 대비 latest.json 회귀 확인
make eval-check

# 경로/임계 커스텀
cd apps/ai_engine && python -m eval.check_regression \
  --baseline eval/baseline.json \
  --latest eval/results/latest.json \
  --threshold 0.02
```

### CI 통합

`.github/workflows/ci-ai-agent.yml`에 두 step으로 통합되어 있습니다:
1. `Run eval sample (API key available only)` — `ANTHROPIC_API_KEY` 시크릿이 있을 때만 소규모 샘플 실행 (LIMIT=5) → `latest.json` 생성. 시크릿은 job env `HAS_API_KEY`로 승격 후 `if: env.HAS_API_KEY == 'true'`로 게이팅.
2. `Eval regression gate (non-blocking)` — 항상 실행. `latest.json`(Step 1 생성)이 있을 때만 baseline 대비 비교, 없으면 no-op.

---

## baseline 갱신 절차 {#baseline-갱신-절차}

> **현재 baseline.json**: 초기 시드 (VAL-1 수동 런, LIMIT=5, total=55)
> **갱신 권장 시점**: LIMIT≥100 또는 풀런(2,740 케이스) 완료 후

### 갱신 방법

```bash
# 1. 대규모 eval 실행 (예: LIMIT=100 또는 풀런)
make eval LIMIT=100
# 또는 풀런 (야간 권장)
make eval

# 2. latest.json 값 확인
cat apps/ai_engine/eval/results/latest.json

# 3. baseline 갱신 (latest.json을 baseline.json으로 복사)
cp apps/ai_engine/eval/results/latest.json apps/ai_engine/eval/baseline.json

# 4. baseline.json에 _note 필드 추가 (갱신 사유 기록 권장)
# 예: "풀런 2026-07-01, total=2740, model=claude-sonnet-4-5"

# 5. 커밋
git add apps/ai_engine/eval/baseline.json
git commit -m "chore(eval): baseline 갱신 — 풀런 YYYY-MM-DD"
```

### 갱신 시 주의사항

- baseline은 **대표 런** 결과여야 합니다. 소규모 샘플(LIMIT=5)은 통계적으로 불안정하므로 참고용으로만 사용하세요.
- 의도적인 모델 변경(업그레이드) 후에도 baseline을 갱신해야 합니다.
- baseline 갱신 커밋에는 실행 조건(모델, LIMIT, 날짜)을 명시하세요.

---

## 보안·윤리

- `ANTHROPIC_API_KEY`는 환경변수에서만 읽습니다. 코드·로그에 출력하지 않습니다.
- BenchmarkJava는 공개 합성 데이터셋입니다 (실제 프로젝트 코드 아님).
- 하니스는 OWASP 공개 레포를 읽기 전용으로 분석합니다.
