# eval/provider_compare — SAST Provider 품질 비교 하니스

COST-2 구현물. 동일 파일셋에 대해 provider(Gemini, Claude 등)별 SAST를 실행하고
findings 집합을 비교해 recall gap 및 오탐 후보를 수치로 산출한다.

## 목적

- Gemini(저비용 AUDIT) vs Claude(고품질 PIPELINE) 결과 차이를 정량화
- `(file, line, type)` 기준 집합 비교: 교집합(합의) / Claude-only(Gemini 미탐) / Gemini-only(추가·오탐 후보)
- **VAL-1 절대채점(ground truth)과 중복 금지** — 상대 비교 + 수동 spot-check MVP

## 사용법

```bash
# 기본: Gemini vs Claude, 파일 수 제한 없음
make eval-providers TARGET=apps/backend/src

# LIMIT 지정 (빠른 검증)
make eval-providers TARGET=apps/backend/src PROVIDERS=gemini,anthropic LIMIT=10

# 직접 실행
cd apps/ai_engine
python -m eval.provider_compare.runner \
  --target /path/to/target \
  --providers gemini,anthropic \
  --limit 20 \
  --output eval/provider_compare/results/latest.json
```

## 출력

### 수치 표 (stdout)
```
--------------------------------------------------------------------
Provider       Files  Findings Severity (C/H/M/L)           Latency(s)  Est.Cost($)
--------------------------------------------------------------------
anthropic          5        12 C:2 H:5 M:3 L:2                    42.1     0.003200
gemini             5         9 C:1 H:4 M:2 L:2                    18.3     0.000800
--------------------------------------------------------------------

=== Recall Gap / FP Candidate Analysis ===
Consensus (both found)   :    7 findings
anthropic-only (recall gap for gemini)  :    5 findings
gemini-only (recall gap for anthropic / FP candidate):    2 findings
Relative recall anthropic: 77.8%  gemini: 58.3%  (vs each other — spot-check required for ground truth)
```

### latest.json
`eval/provider_compare/results/latest.json` 에 저장:
- `provider_stats`: 각 provider의 파일 수·finding 수·severity·지연·토큰
- `compare`: 교집합·A-only·B-only 수치 + spot-check용 샘플 목록(최대 100개)

## 구조

| 파일 | 역할 |
|------|------|
| `report.py` | `FindingKey`, `compare_findings`, `build_summary_table` — 순수함수, 테스트 가능 |
| `runner.py` | `run_compare`, `_collect_files`, `_analyze_file_with_retry` — 실행 하니스 |

## 설계 원칙

- **DIP**: `analyze_for_sast(provider=<p>)` 경유 → COST-1 `LLMProvider` Protocol 재사용
- **SRP**: 집합 비교(report.py) / 파일 수집·실행(runner.py) 분리
- **OCP**: `FindingKey` NamedTuple을 VAL-1 scorer가 재사용 가능하도록 공개
- 키없음 provider 스킵, 파일 오류 skip&log, rate limit 지수 백오프
- 토큰·키 로그 금지

## 전제 조건

- `GEMINI_API_KEY` (Gemini 사용 시) 및 `CLAUDE_API_KEY` (Anthropic 사용 시) `.env` 설정
- COST-1 `agent/llm/` 구현 완료 (provider 팩토리)
