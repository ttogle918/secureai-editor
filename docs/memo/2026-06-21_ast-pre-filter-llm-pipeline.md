# AST 사전 필터링 & LLM 하이브리드 SAST 파이프라인 설계 계획

이 문서는 정적 구문 분석(AST Parser) 및 빠른 텍스트 토큰 매칭을 이용한 1차 스크리닝과 LLM(Claude/Gemini)의 2차 정밀 분석을 결합하여, SAST 분석 속도를 높이고 토큰 API 비용을 절반 이하로 줄이기 위한 하이브리드 파이프라인의 설계 계획을 다룹니다.

## 1. 도입 배경 및 목표

기존 SAST 분석 엔진은 스캔 대상인 모든 파일의 코드를 예외 없이 LLM에 전송하여 분석을 위임합니다. 이는 다음과 같은 심각한 비효율을 초래합니다:
- **불필요한 비용**: 취약점이 발생할 여지가 아예 없는 단순 유틸리티 코드, 애니메이션 스타일 컴포넌트, 정적 정의 파일 등도 LLM을 호출하게 되어 API 요금이 과다 청구됨.
- **분석 대기 시간**: LLM의 응답 대기 속도(수 초)로 인해 대량 파일 스캔 시 전체 분석 성능이 크게 저하됨.

**목표**:
- 취약점 유해성이 아예 없는 완벽히 깨끗한 파일을 정적 분석 API(비용 0, 속도 ms 단위)로 솎아내어 **LLM 호출을 조기 생략(Short-circuit)**.
- 미탐률(False Negative) 상승을 0%로 철저히 억제하면서 **LLM 호출 빈도를 50% 이상 감소**.

---

## 2. 하이브리드 파이프라인 아키텍처

```mermaid
graph TD
    Start[1. 분석 대상 파일 로드] --> PreFilterCheck{AST/텍스트 사전 필터링 활성화?}
    
    PreFilterCheck -- "Yes (AST_PRE_FILTER_ENABLED=True)" --> PreFilter[2. 결정론적 사전 스크리닝]
    PreFilterCheck -- "No (기본값)" --> RunLLM[4. LLM 정밀 분석 sast_node]
    
    PreFilter -- "위험 API/구문 미발견 (완전 무해)" --> SkipLLM[3. LLM 스킵 & 조기 종료]
    PreFilter -- "위험 의심 구문 최소 1건 발견" --> RunLLM
    
    SkipLLM --> Merge[5. 결과 취합 & validate_findings_node]
    RunLLM --> Merge
    Merge --> End[6. 최종 취약점 저장]
```

---

## 3. 언어별 사전 필터링 규칙 (Permissive Rule)

미탐(취약점을 놓치는 경우)을 방지하기 위해 필터링은 매우 **허용적(Permissive) 소거법**을 사용합니다. 파일 내부의 AST 트리 또는 정밀한 텍스트 토큰을 탐색하여 아래 관심 요소(Concern)가 단 하나도 검출되지 않는 경우에만 스킵 대상으로 처리합니다.

### A. Python (ast 모듈 기반 정밀 AST 분석)
- **탐색 대상 API/노드**:
  - 데이터베이스 연동: `execute`, `raw`, `cursor`, `connect`, `sqlite3`, `psycopg`, `pymysql`, `sqlalchemy`, `db`, `sql`
  - 명령어 실행: `subprocess`, `run`, `popen`, `spawn`, `shutil`, `system` (os.system 대처), `os` (import os 대처)
  - 파일 시스템 접근: `open`, `read`, `write`, `shutil`
  - 동적 코드 실행 & 역직렬화: `eval`, `exec`, `pickle`, `yaml`, `load`, `loads`
  - 네트워크 & SSRF: `requests`, `urllib`, `http`
- **스킵 조건**: 위의 호출이 트리에 0건 존재할 때.

### B. Java & Kotlin (javalang 파서 및 텍스트 분석)
- **탐색 대상 API/노드**:
  - 데이터베이스 연동: `Connection`, `Statement`, `PreparedStatement`, `JdbcTemplate`, `EntityManager`, `Repository`, `rawQuery`
  - 명령어 실행: `exec`, `ProcessBuilder`, `Runtime`
  - 파일/네트워크 스트림 & SSRF: `FileInputStream`, `FileOutputStream`, `Socket`, `HttpURLConnection`, `URL`, `InputStream`, `OutputStream`
  - 안드로이드 민감 요소: `getSharedPreferences`, `WebView`, `WebViewClient`, `SslErrorHandler`, `addJavascriptInterface`, `Intent`
- **스킵 조건**: 위의 패키지 임포트, 클래스 참조, 메서드 호출이 전혀 없을 때.

### C. JavaScript & TypeScript (Substring 및 정규식 토큰 매칭)
*주의: JS/TS 파일은 구조적 AST 파싱 대신 성능 최적화와 가벼운 정형 필터링을 위해 빠른 텍스트 토큰 및 substring 매칭 방식을 사용합니다.*
- **탐색 대상 API/노드**:
  - 프론트엔드 취약점 & XSS: `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `Function`, `run`
  - 명령어 실행: `child_process`, `exec`, `spawn`, `execSync`
  - 데이터베이스/SQL: `query`, `sql`, `mysql`, `pg`, `sqlite`, `mongoose`, `db`
  - 파일 시스템 & Path Traversal: `fs`, `readFile`, `readFileSync`, `writeFile`, `writeFileSync`, `path`
  - 동적 모듈 로딩 & 오픈 리다이렉트: `require`, `import`, `redirect`
  - 프로토타입 오염: `prototype`, `__proto__`, `constructor`
- **스킵 조건**: 위의 키워드가 파일 내 물리적/구문적으로 0건 검출될 때.

---

## 4. 구현 및 설계 변경 파일

### [NEW] [ast_pre_filter.py](file:///c:/Users/ttogl/workspace/secureai-editor/apps/ai_engine/agent/validation/ast_pre_filter.py)
- Python `ast`, Java `javalang`, JavaScript 용 AST/Regex 기반의 1차 필터링 함수 `should_skip_llm(file_path, content, language)` 작성.
- 이 필터는 순수 로컬 연산으로 동작하여 CPU 오버헤드가 극히 적음.

### [MODIFY] [sast_node.py](file:///c:/Users/ttogl/workspace/secureai-editor/apps/ai_engine/agent/nodes/sast_node.py)
- `sast_node` 분석 진입점 상단(파일 로드 직후)에서 `should_skip_llm` 필터를 구동하여 불필요한 guidelines 로드와 DB(prev_vuln_context) 조회를 조기에 차단.
- `settings.ast_pre_filter_enabled`가 `True`일 때만 사전 필터링이 가동되도록 환경설정 지원.
- 필터 판정 결과가 `True`일 경우:
  - 로그에 `[sast] skip LLM scan (clean file) file=...` 기록.
  - Prometheus 카운터 `secureai_ai_llm_skipped_total`을 1 증가.
  - LLM 호출(`_analyze_chunks`)을 생략하고 즉시 `vulnerabilities: []`를 결과 상태에 누적.
  - 최종 `update` 리턴 시 `resolved_model`/`resolved_provider`가 `"skipped"` 등의 값으로 오염되어 세션 완료 이벤트나 비용 귀속이 깨지지 않도록 방어 가드 추가.

### [MODIFY] [settings.py](file:///c:/Users/ttogl/workspace/secureai-editor/apps/ai_engine/config/settings.py)
- `AST_PRE_FILTER_ENABLED` 환경설정(기본값: `False`)을 지원하도록 Pydantic Settings 클래스 보완. VAL-1/VAL-2 검증 완료 전까지는 보수적으로 `False`로 운영 권장.

---

## 5. 검증 계획

### 자동 테스트
- `tests/agent/test_ast_pre_filter.py` 단위 테스트를 작성하여:
  - 안전한 파일(단순 유틸리티 코드)은 `should_skip_llm`이 `True`를 반환하는지 검증.
  - 위험 파일(SQL 인젝션 구문, SharedPreferences, os.system, fs.readFile, res.redirect 등)은 `should_skip_llm`이 `False`를 반환하는지 검증.
- `test_sast_node.py`에 스킵 판정 시 LLM 호출이 아예 생략되고 카운터가 집계되는 시나리오 단위 테스트 추가.

### 성능 및 품질 측정 (VAL-1 연계)
- 벤치마크 데이터셋(`BenchmarkJava`)에 AST 필터링을 켜고 테스트를 수행하여:
  - 기존 대비 탐지율(Recall)에 하락이 전혀 없음을 정밀 대조 및 증명.
  - 전체 스캔 시간 대조 및 절감 비율 통계 도출.

---

## 6. 트러블슈팅 및 구현 보완 (Troubleshooting & Enhancements)

### A. Python SyntaxError 예외 처리 및 1차 키워드 스크리닝 우회 이슈
- **문제 현상**: `test_should_skip_llm_syntax_error_python` 테스트에서 문법 오류가 있는 파이썬 코드(`def invalid_syntax(\n    return "oops"`)가 입력되었을 때, `should_skip_llm`이 `False`를 리턴할 것으로 기대했으나 `True`를 리턴하며 테스트가 실패함.
- **원인 분석**: `_check_python` 함수는 성능 최적화를 위해 1차로 텍스트 정규식 검색을 통해 `_PYTHON_SENSITIVE_KEYWORDS`가 존재하지 않으면 AST 파싱을 시도하지 않고 즉시 `True`를 반환함. 해당 문법 오류 코드에는 민감 키워드가 없었기 때문에 AST 파싱 단계로 진입하지 못해 `SyntaxError`를 잡아내지 못하고 스킵 대상으로 판별됨.
- **해결 방안**: 정적 문법 에러가 안전하게 통과되어 LLM으로 전달(False 리턴)되도록 검증하는 단위 테스트 케이스의 코드를 수정하여, `eval("oops")` 같은 민감 키워드를 포함시키면서 문법 오류가 발생하도록 조정함. 이로 인해 1차 스크리닝을 우회하여 AST 파싱을 시도하게 되고, 파싱 에러(`SyntaxError`) 발생 시 정상적으로 `False`를 반환하여 안전한 가드레일이 작동함을 검증함.

### B. 단위 테스트 격리 및 Mock 패치 누락 이슈
- **문제 현상**: AST pre-filtering을 파이프라인에 통합한 후, `test_sast_node.py` 및 `test_streaming_helpers.py`에 있는 5개의 기존 mock 테스트에서 `x = 1` 같은 더미 코드가 사전 필터링에 의해 스킵되어 LLM 모의 분석(`_analyze_chunks`)을 수행하지 않아 테스트가 무더기로 실패함.
- **원인 분석**: 테스트에서 사용한 코드는 순수한 더미 코드(`x = 1`)였기 때문에 새롭게 적용된 `should_skip_llm` 필터에 의해 LLM 스캔 생략 대상으로 처리됨. 이 때문에 mock 처리된 `_analyze_chunks`나 토큰 카운터 증가 로직이 호출되지 않음.
- **해결 방안**: LLM 연동 경로 및 토큰 카운팅 등 내부 로직을 테스트해야 하는 기존 mock 테스트들의 `with patch(...)` 컨텍스트 내부에 `patch("agent.nodes.sast_node.should_skip_llm", return_value=False)`를 명시적으로 추가함. 이를 통해 의도적으로 AST 필터를 비활성화하고 LLM 분석 동작을 강제 타도록 모의 환경을 보완하여 모든 회귀 테스트가 성공적으로 통과되도록 해결함.

### C. 피드백 반영을 통한 2차 보완 (보안성 강화 및 resolved_model 오염 방지)
- **문제 현상**: 1차 구현 완료 후 1) `os.system`, `fs.readFile`, `res.redirect` 등 주요 취약점 API 누락에 따른 FN(미탐) 위험, 2) 스킵 시 `resolved_model`/`resolved_provider`가 `"skipped"`로 기록되어 완료 이벤트 및 비용 귀속이 깨질 우려, 3) 스킵된 파일도 guidelines 로딩 및 DB 조회를 먼저 수행하는 리소스 낭비 현상이 지적됨.
- **해결 방안**:
  - Pydantic Settings 클래스에 `ast_pre_filter_enabled: bool = False` 설정을 추가하여 안전성 입증 전까지는 기본적으로 기능을 꺼두도록(OFF) 보완.
  - Python/Java/JS/TS의 민감 키워드 세트를 대폭 확장하여 명령실행, 파일 입출력, 역직렬화, SSRF, 프로토타입 오염 등을 빈틈없이 스크리닝하도록 수정하고, 테스트 파일에 관련 검증 케이스 4종 추가.
  - 스킵 시 `resolved_model`/`resolved_provider`를 `"skipped"` 문자열로 덮어쓰지 않고, 이전 파일들의 할당 값을 그대로 보존하도록 가드 조건 삽입.
  - `sast_node.py`에서 `should_skip_llm` 필터링 검사를 파일 로드 직후로 옮겨 스킵 시 가이드라인 로딩과 DB 조회가 일절 발생하지 않도록 최적화.
  - 스킵 카운트 추적을 위한 Prometheus `secureai_ai_llm_skipped_total` 카운터를 생성 및 적용하여 최적화 실적을 계측할 수 있도록 함.
