# VAL-1: Eval 하니스 실행 실패 트러블슈팅

**날짜**: 2026-06-18  
**브랜치**: `feat/sprint13-val`  
**관련 커밋**: `1da87a5`

---

## 이슈 1 — BenchmarkJava 깃 태그명 오류

### 증상
```
make eval-fetch 실행 시
git clone --depth 1 --branch v1.2beta https://github.com/owasp-benchmark/BenchmarkJava.git
fatal: reference is not a tree: v1.2beta
```

### 원인 분석
`runner.py`와 `fetch.sh`에서 BenchmarkJava 태그명을 `v1.2beta`로 지정했으나, 실제 BenchmarkJava 저장소의 태그는 `1.2beta`(prefix 없음).  
두 파일이 불일치.

### 해결
- `fetch.sh`: `git clone ... --branch 1.2beta ...` 수정
- `runner.py`: `BENCHMARK_TAG = "1.2beta"` 정정 + 상수화(`BENCHMARK_TAG`)
- 이후 fetch 정상(~200MB).

---

## 이슈 2 — expectedresults.csv 필드 파싱 오류

### 증상
```python
csv.DictReader(f, fieldnames=['category', 'test_id', ...])
# category 필드 컬럼 미매칭
# 실제 CSV:
#   " category" (선행 공백) | " test_id" (선행 공백)
# 매핑 실패 → category 값 읽기 불가
```

### 원인 분석
BenchmarkJava expectedresults.csv 헤더와 값에 선행 공백(`, category,`, `,test_id,`)이 있으나,  
`csv.DictReader(...)`는 기본적으로 선행/후행 공백을 제거하지 않음 → 컬럼명 불일치.

### 해결
```python
csv.DictReader(f, fieldnames=[...], skipinitialspace=True)
```
skipinitialspace=True로 필드 인덱스 좌측 공백 제거. CSV 파싱 정상화.

---

## 이슈 3 — eval 대상 provider/model 선택 불가

### 증상
`make eval LIMIT=5` 실행 시 runner.py가 호출하는 analyze_for_sast()가 기본 provider/model(예: claude-opus)로만 분석 → VAL-1의 평가 대상(Gemini 등)으로 실행 불가.  
수동검증에서 eval을 다른 AI provider로 재실행할 수 없음.

### 원인 분석
`runner.py`의 analyze_for_sast() 호출이:
```python
analyze_for_sast(source_code, language)
# provider, model 파라미터 없음
```
환경 변수(EVAL_PROVIDER, EVAL_MODEL)도 읽지 않음 → 기본값 고정.

### 해결
1. runner.py에서 `EVAL_PROVIDER`, `EVAL_MODEL` env 변수 읽기:
   ```python
   EVAL_PROVIDER = os.getenv('EVAL_PROVIDER', 'anthropic')
   EVAL_MODEL = os.getenv('EVAL_MODEL', 'claude-opus')
   ```
2. analyze_for_sast() 호출 시 provider/model 전달:
   ```python
   analyze_for_sast(source_code, language, provider=EVAL_PROVIDER, model=EVAL_MODEL)
   ```
3. latest.json에 model 기록 시 실제 평가 모델 기록:
   ```json
   {
     "model": "gemini-2.0-flash",
     "timestamp": "2026-06-18T..."
   }
   ```
   (예: EVAL_MODEL=gemini-2.0-flash로 실행하면 해당 모델 기록)

4. .env 또는 make eval 호출 시 env 지정:
   ```bash
   EVAL_PROVIDER=google EVAL_MODEL=gemini-2.0-flash make eval LIMIT=5
   ```

### 검증 결과
- `make eval-fetch`: 정상(200MB)
- `make eval LIMIT=5`: 정상(결과 산출, 단위 76 그린)
- latest.json: 실행한 provider/model 기록 확인

---

## 요약

| 이슈 | 원인 | 수정 |
|------|------|-----|
| BenchmarkJava 태그 | 저장소 실제 태그 `1.2beta` vs. 코드 `v1.2beta` | fetch.sh + runner.py 동기화 |
| CSV 파싱 | expectedresults.csv 헤더 선행 공백 | `skipinitialspace=True` 추가 |
| Provider 선택 불가 | env 변수 미읽기 + 기본값 고정 | EVAL_PROVIDER/EVAL_MODEL env 읽기 + 상수화 + latest.json 모델 기록 |
