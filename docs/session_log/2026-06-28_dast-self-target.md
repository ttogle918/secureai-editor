# [2026-06-28] DAST 자체 타깃(FastAPI) 준비 + 아키텍처 검토

**브랜치**: `main` (secureai-editor 레포 기준 — 코드 변경 없음)  
**작업 범위**: DAST 아키텍처 검토 + FastAPI 취약앱 준비 완료 (외부 레포) + 다음 세션 DAST 검증 계획

---

## 1. 완료 작업

| 항목 | 주요 파일 | 상태 |
|------|---------|------|
| DAST 엔드포인트 발견 능력 조사 (Flask 미지원 확인) | `apps/ai_engine/agent/nodes/api_discovery_node.py` | ✅ 완료 |
| DAST 실행 모델 분석 (in-process httpx, 배치 제어) | `apps/ai_engine/agent/dast_runner.py` | ✅ 완료 |
| **FastAPI 취약앱 코드 작성 완료** | `C:\Users\ttogl\workspace\fastapi-vuln-sample/` (main.py, db.py, routes/users.py, routes/proxy.py, requirements.txt, Dockerfile) | ✅ 완료 |
| **Docker 이미지 빌드 완료** | `fastapi-vuln-sample:latest` | ✅ 완료 |
| **컨테이너 네트워크 검증 완료** | `docker run ... --network secureai-editor_app-net` → localhost:8000=200, ai_engine→http://fastapi-vuln:8000 도달 검증됨 | ✅ 완료 |
| **kkebi 레포 통합 완료** | `kkebi/fastapi-vuln-sample/` 복사 (demo-vuln-sample 포함) | ✅ 완료 |

---

## 2. 의논 내용 & 결정 맥락

### 2.1 DAST 워크스페이스 병목: 엔드포인트 발견
**발견 사항**: api_discovery_node는 **프레임워크별 라우팅 데코레이터**를 파싱해서 엔드포인트 추출
- ✅ **Spring** (@*Mapping: @RequestMapping, @GetMapping, @PostMapping, 등)
- ✅ **FastAPI** (@router.get, @router.post, 등)
- ✅ **Next.js** (route.ts, layout.ts app router)
- ❌ **Flask** (@app.route, @app.get, 등) — **미지원**

**demo-vuln-sample 문제**:
- Flask 앱 (5파일: app.py, routes/..., config.py, 등)
- api_discovery_node가 Flask 데코레이터를 파싱하지 못함
- 결과: DAST 워크스페이스에 엔드포인트 0개 → 배치 실행 불가능 → 빈 화면

**대안 선택 사유**:
| 대안 | 장점 | 단점 | 결정 |
|------|------|------|------|
| A. FastAPI 자체 타깃 (fastapi-vuln-sample) | ✓ 엔드포인트 자동 발견 ✓ 자기완결 ✓ 빠른 데모 | 새 앱 작성 소요 | **선택** ✅ |
| B. api_discovery_node에 Flask 지원 추가 | ✓ 기존 타깃 그대로 사용 | ⚠️ 파서 확장 복잡 ⚠️ 데모 시간 초과 | 백로그 |
| C. WebGoat (Java 기반 교육용 타깃) | ✓ 증명된 취약점 풍부 | ✗ 네트워크 격리(dast-isolated-net) ✗ 컨테이너 unhealthy ✗ 데모 준비 어려움 | 불가 |

### 2.2 DAST 실행 모델 (in-process httpx 아키텍처)
```
1. FE: POST /api/dast/batch
   → 타깃 URL 목록 + 타깃 프로파일(SQLi/XSS/IDOR/SSRF/AuthBypass)
   
2. Backend: StartDastAnalysisRequest → AI Engine 큐에 적재

3. AI Engine (dast_runner.py):
   - _EXECUTOR_MAP[vulnerability_type] = executor function
   - executor = httpx 직접 호출 (app-net 내부에서 in-process)
   - 타임아웃: 30초/executor
   - 동시성: _BATCH_CONCURRENCY=4 (4개 병렬 실행)
   - 최대 타깃: _BATCH_MAX_TARGETS=50 (초과 시 422 반환)
   
4. Spring SseEmitter → FE useSse 훅
   - "exploiting SSRF..." → "EXPLOITED" → 스코어카드 팝업(scorecard.md 발췌)
```

**특징**: httpx 자체가 app-net 내부에서 동작하므로, 자체 타깃도 컨테이너로 app-net에 기동 필요.

### 2.3 FastAPI 자체 타깃 (A안) — 구현 완료
**구조**: `C:\Users\ttogl\workspace\fastapi-vuln-sample/` (외부 레포, secureai-editor 포함 X)
```
fastapi-vuln-sample/
├── main.py              # FastAPI app + include_router(users, proxy) ✅
├── db.py                # sqlite3 직접 (vuln_shop.db 시드: admin/alice/bob) ✅
├── routes/
│   ├── __init__.py
│   ├── users.py         # SQLi + IDOR + XSS ✅
│   └── proxy.py         # SSRF + Command Injection ✅
├── requirements.txt     # fastapi==0.110.0, uvicorn==0.27.0, requests==2.31.0 ✅
└── Dockerfile           # python:3.12-slim, CMD uvicorn main:app --port 8000 ✅
```
> ※ docker-compose.yml은 안 만듦. 컨테이너는 `docker run`으로 app-net에 직접 기동(아래 88번).

**취약점 매핑 (실제 작성된 엔드포인트 — 전부 GET)**:
| 엔드포인트 | 취약점(SAST type) | 설명 | 파일 |
|----------|------|------|------|
| `/users/search?q=&sort=` | SQL_INJECTION | q·sort를 f-string으로 쿼리 삽입 | routes/users.py |
| `/users/{user_id}` | IDOR + SQL_INJECTION | 인가 없이 임의 id 조회 + id 직접 삽입 | routes/users.py |
| `/greet?name=` | XSS(반사형) | name을 이스케이프 없이 HTML 반영 | routes/users.py |
| `/fetch?url=` | SSRF | url을 requests.get으로 직접 호출 | routes/proxy.py |
| `/ping?host=` | COMMAND_INJECTION | host를 subprocess(shell=True) 전달 | routes/proxy.py |

> ⚠️ DAST executor는 SQL_INJECTION/XSS/IDOR/SSRF/AUTH_BYPASS만 존재 → COMMAND_INJECTION은 SAST엔 잡혀도 DAST 배치 대상은 아님. **DAST 검증은 SQLi·SSRF·XSS·IDOR로.**

**배포 완료**:
1. ✅ Docker 이미지 빌드: `fastapi-vuln-sample:latest` (Python 3.12 slim)
2. ✅ 컨테이너 실행 중: `docker run -d --name fastapi-vuln --network secureai-editor_app-net -p 8000:8000 fastapi-vuln-sample:latest`
3. ✅ 도달성 검증:
   - 호스트: `http://localhost:8000` → 200 OK
   - ai_engine 내부: `http://fastapi-vuln:8000` → 200 OK (app-net에서 도달)
4. ✅ kkebi 레포 통합: `kkebi/fastapi-vuln-sample/` 복사 (demo-vuln-sample과 함께 스캔 가능)
5. ✅ 캐시 클리어 완료

### 2.4 데모 시나리오 (DAST 검증 가능 상태)
**VC 데모 7씬 시나리오 순서** (4:30~5:00, FastAPI 타깃 준비 완료):
1. **로그인** (0:00~0:20)
2. **SAST 분석** (0:20~1:00)
   - 진행률·AI로그 라이브 표시
   - 취약점 목록
3. **DAST 증명** (1:00~2:00) ★클라이맥스
   - DAST 워크스페이스 → 엔드포인트 입력(fastapi-vuln:8000)
   - 배치 실행 → SSE 라이브 터미널 (exploiting ... → EXPLOITED)
   - 스코어카드(SSRF = verified + proof)
4. **자동 패치** (2:00~2:30)
   - 취약점 선택 → Patch Manager diff 확인
5. **GitHub PR 생성** (2:30~3:00)
   - PR 모달 → ttogle918/kkebi 입력 → PR #1 (또는 #N)
6. **규제 문서 PDF 내보내기** (3:00~3:30)
   - REPORTS → "규제 문서" (ISMS-P/CISO)
7. **비즈니스 모델 /billing** (3:30~4:00)
   - 요금제 카드 + BYOK/크레딧 토글

**마무리 내레이션**: "증명된 취약점만, 고쳐서 PR로, 원가까지 투명하게."

### 2.5 현재 상태 vs 다음 세션 할 일
**완료 (본 세션 이전)**:
- ✅ DAST 실행 모델 이해
- ✅ FastAPI 취약앱 코드 작성 (routes/users.py, proxy.py, main.py, db.py)
- ✅ Docker 이미지 빌드 (fastapi-vuln-sample:latest)
- ✅ 컨테이너 네트워크 구성 검증 (app-net 도달 확인)
- ✅ kkebi 레포 통합 (fastapi-vuln-sample/ 복사)
- ✅ 캐시 클리어 완료

**다음 세션 (DAST 검증 단계)**:
- ⏳ kkebi 워크스페이스 재오픈 (fastapi-vuln-sample 포함 캐시 로드)
- ⏳ SAST 스캔 (엔드포인트 발견 확인: /users, /proxy, /login 등)
- ⏳ **DAST 워크스페이스**: 타깃 URL `http://fastapi-vuln:8000` 입력 → 취약점 선택(SQLi/IDOR/SSRF) → 배치 실행
- ⏳ **SSE 라이브 로그**: exploiting ... → EXPLOITED 배지 확인
- ⏳ scorecard.md 팝업 검증 (SSRF/RCE proof)

---

## 3. 특이사항 / 설계 결정

| 항목 | 선택 | 이유 |
|------|------|------|
| **타깃 프레임워크** | FastAPI (A안) | Flask 미지원 + 빠른 대체 |
| **배포 모드** | Docker 컨테이너 (app-net 격리망) | 기존 DAST 아키텍처와 일관 |
| **엔드포인트 자동발견** | ✅ FastAPI @router.* 파싱 | 매뉴얼 입력 불필요 |
| **데모 클라이맥스** | DAST EXPLOITED 배지 (라이브 SSE) | 증명된 취약점 강조 |
| **API 문서화** | OpenAPI (FastAPI 자동 생성) | 추가 관리 불필요 → /docs |

---

## 4. 다음 세션에서 할 것

**0) 환경 확인 명령 (먼저 실행)**
```bash
# 서비스 (3000 FE, 8080 backend=401 정상, ai_engine는 내부 8000)
docker compose ps
# FastAPI 타깃 살아있나? (없으면 아래 docker run으로 재기동)
docker ps --format "{{.Names}} {{.Status}}" | grep fastapi-vuln
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/   # 200 기대
# 없으면 재기동 (이미지 fastapi-vuln-sample:latest 빌드돼 있음)
docker run -d --name fastapi-vuln --network secureai-editor_app-net -p 8000:8000 fastapi-vuln-sample:latest
# 신선 스캔용 캐시 클리어 (REDIS_PASSWORD는 .env, DB 1)
PASS=$(grep -E '^REDIS_PASSWORD=' .env | cut -d= -f2-)
docker compose exec -T redis redis-cli -a "$PASS" -n 1 EVAL "local n=0; for _,p in ipairs({'secureai:sast:cache:*','secureai:patch:*'}) do local k=redis.call('keys',p); for i=1,#k do redis.call('del',k[i]); n=n+1 end end; return n" 0
```
> 로그인: devtest@secureai.test / Test1234 (브라우저 자동화 시 MCP 창에서 직접 로그인). 모델은 /settings에서 Gemini 2.5 Flash 선택돼 있어야 함.

- [ ] **kkebi 워크스페이스 재오픈** (fastapi-vuln-sample 포함)
  - 좌측 사이드바 "워크스페이스 선택기" → kkebi 폴더 선택
  - 캐시 반영 (fastapi-vuln-sample/, demo-vuln-sample/ 모두 가시)

- [ ] **SAST 스캔** (fastapi-vuln-sample)
  - 분석 시작 → api_discovery_node가 FastAPI 엔드포인트 발견 (/users/search, /users/{id}, /greet, /fetch, /ping)
  - 취약점 목록 확인 (SQL_INJECTION, IDOR, XSS, SSRF, COMMAND_INJECTION)
  - ⚠️ 만약 엔드포인트 0개로 나오면: api_discovery가 routes/ 글롭·@router.* 매칭 확인 필요(이게 첫 버그 후보)

- [ ] **DAST 워크스페이스 검증**
  - DAST 탭 → "DAST 시작" → 타깃 URL 입력: `http://fastapi-vuln:8000`
  - 취약점 선택 (SQLi/IDOR/SSRF/RCE 등)
  - 배치 실행 (concurrent=4)
  - SSE 라이브 로그 (exploiting ... → EXPLOITED 배지)
  - scorecard.md 팝업 (proof snippet)

- [ ] **VC 데모 촬영** (DAST 클라이맥스 포함)
  - SAST (Gemini 2.5 Flash, 실시간 진행률)
  - → DAST (fastapi-vuln:8000, EXPLOITED 라이브)
  - → PATCH (자동 수정)
  - → PR (GitHub 생성)
  - → 규제 PDF
  - → /billing (과금 투명성)

---

## 5. 형상관리

**브랜치**: main (secureai-editor 레포 기준 — 코드 변경 없음)  
**주의**: FastAPI 취약앱은 secureai-editor 레포 **외부** (`C:\Users\ttogl\workspace\fastapi-vuln-sample/`)에서 관리
- 호스트 컨테이너 실행 (`fastapi-vuln-sample:latest`)
- kkebi 레포에 복사 완료 (`kkebi/fastapi-vuln-sample/`)
- 별도 형상 관리 불필요 (데모 전용, 취약앱은 공용)

**참고 (secureai-editor 코드)**: 
- DAST 코드베이스: `apps/ai_engine/agent/dast_runner.py`, `nodes/api_discovery_node.py`
- 실행 엔드포인트: `apps/backend/src/api/routes/dast.py`
- SSE 스트리밍: `apps/backend/src/api/routes/analysis.py` (getStream)
