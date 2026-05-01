# SecureAI — 보안 점검 흐름 & 체크포인트 설계서
> 작성자: 보안 전문가 · AI 전문가 · 시니어 백엔드 · 데이터 아키텍처 공동 확정  
> 작성일: 2026-04-19 | 버전: v1.0  
> 관련 문서: `02_API_DESIGN.md`, `05_ARCHITECTURE_PHILOSOPHY.md`

---

## 목차

1. [설계 목표](#1-설계-목표)
2. [Temp 파일 vs DB 저장 — 최종 결정](#2-temp-파일-vs-db-저장--최종-결정)
3. [저장소 계층 분리](#3-저장소-계층-분리)
4. [보안 점검 전체 흐름도](#4-보안-점검-전체-흐름도)
5. [체크포인트 테이블 설계](#5-체크포인트-테이블-설계)
6. [LangGraph Checkpointer 연동](#6-langgraph-checkpointer-연동)
7. [사용자용 체크리스트 MD 자동 생성](#7-사용자용-체크리스트-md-자동-생성)
8. [중단·재개 시나리오](#8-중단재개-시나리오)
9. [데이터 수명주기 & 삭제 정책](#9-데이터-수명주기--삭제-정책)

---

## 1. 설계 목표

사용자의 요구사항을 4가지로 분해:

| 요구 | 해결 메커니즘 |
|------|-------------|
| (a) 체크박스 형식으로 진행 상태 시각화 | 사용자용 체크리스트 MD 자동 생성 |
| (b) 중단되더라도 다음에 이어서 하기 | LangGraph Checkpointer + PostgreSQL |
| (c) DB에 저장할지 Temp 파일로 할지 결정 | **PostgreSQL 전용 테이블** (아래 근거 참고) |
| (d) 진행 로그 추적 | `analysis_progress_log` 테이블 |

---

## 2. Temp 파일 vs DB 저장 — 최종 결정

### 의논 결과: **PostgreSQL DB 저장 ✅**

### Temp 파일 방식의 치명적 문제

```
❌ 문제 1: 보안 리스크
   - 취약점 분석 중간 결과에는 "취약한 코드 스니펫"이 포함됨
   - 파일시스템 노출 시 고객 코드 유출 가능성
   - 파일 권한 관리 취약

❌ 문제 2: 컨테이너 재시작 시 손실
   - Docker 컨테이너가 재시작되면 /tmp 디렉토리 초기화
   - Kubernetes 환경에서 Pod 재스케줄링 시 파일 소실
   - 정확히 이 시나리오를 대비하는 게 "재개 기능"의 핵심인데 모순

❌ 문제 3: 다중 인스턴스 동기화 불가
   - Spring Boot 인스턴스 2개 이상 운영 시 파일 공유 불가
   - NFS/S3 등 공유 스토리지 추가 비용

❌ 문제 4: 암호화 미적용
   - DB는 AES-256-GCM AttributeConverter로 자동 암호화
   - 파일은 별도 암호화 로직 필요 (복잡도 증가)

❌ 문제 5: 트랜잭션 불가
   - "파일 저장 + DB 커밋" 원자성 보장 어려움
   - 한쪽만 저장되는 불일치 상태 발생
```

### DB 저장 방식의 장점

```
✅ 장점 1: ACID 보장
   - 체크포인트 + 진행 로그 원자적 저장

✅ 장점 2: 자동 암호화
   - JPA AttributeConverter로 민감 데이터 투명 암호화

✅ 장점 3: 쿼리 가능
   - "어떤 세션이 어느 단계에서 중단되었는가" SQL로 즉시 조회

✅ 장점 4: 자동 백업
   - DB 백업 = 체크포인트 포함 전체 백업

✅ 장점 5: LangGraph 네이티브 지원
   - `PostgresSaver`, `PostgresStore` 공식 제공
   - 노드 실행 후 자동 저장 (추가 코드 거의 불필요)
```

### 예외: 최종 리포트 MD 파일만 파일 스토리지

```
사용자 다운로드용 리포트 PDF/MD:
  - 생성 시점 1회만 작성 (중간 수정 없음)
  - 24시간 다운로드 토큰으로 접근 제어
  - 90일 후 자동 삭제
  - 이 경우만 /app/reports/ 볼륨 저장 (Docker Volume)
```

---

## 3. 저장소 계층 분리

```
┌─────────────────────────────────────────────────────────────┐
│  Redis (휘발성, 초단위 갱신)                                  │
│  └─ secureai:session:{sessionId}:progress                   │
│     "현재 진행률: 45%, 현재 단계: SAST 분석 중"                │
│     → SSE로 즉시 클라이언트 전송                              │
└────────────────────────┬────────────────────────────────────┘
                         │ 단계 전환 시 DB 동기화
┌────────────────────────▼────────────────────────────────────┐
│  PostgreSQL (영속, 체크포인트)                                │
│  ├─ agent_checkpoints: LangGraph State 저장                 │
│  │    → 중단 시 재개용 (JSONB)                                │
│  ├─ analysis_progress_log: 진행 단계별 타임스탬프 로그          │
│  │    → 체크리스트 MD 생성 소스                                │
│  └─ vulnerabilities: 최종 취약점 결과                          │
│       → 세션 완료 후 정제된 데이터만 남김                       │
└────────────────────────┬────────────────────────────────────┘
                         │ 분석 완료 시 1회
┌────────────────────────▼────────────────────────────────────┐
│  파일 스토리지 (/app/reports — Docker Volume)                  │
│  └─ 최종 리포트 PDF / MD 파일 (사용자 다운로드)                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. 보안 점검 전체 흐름도

```
┌────────────────────────────────────────────────────────────────────────────┐
│                      SecureAI 보안 점검 파이프라인 전체                      │
└────────────────────────────────────────────────────────────────────────────┘

[클라이언트] POST /analysis/sessions
    │ { projectId, layerType, targetPath }
    ▼
┌──────────────────────────────────────────────────────────────┐
│ Backend: AnalysisService                                     │
│   1. 플랜 사용량 체크 (PlanChecker)                          │
│   2. AnalysisSession DB insert (status=pending)              │
│   3. progress_log 기록: 'session_created'                    │
│   4. SAST 사용량 +1 (users.sast_usage_this_month)            │
│   5. AI Agent HTTP 호출 (@Async)                             │
│   6. 즉시 202 반환 + SSE URL                                  │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│ AI Agent (Python LangGraph)                                  │
│                                                              │
│ [체크포인트 자동 저장 지점]                                    │
│                                                              │
│ ① Node: cache_check                                          │
│    - 파일 SHA-256 계산 → Redis 캐시 조회                      │
│    - PostgresSaver: agent_checkpoints insert                 │
│    - progress_log: 'cache_check_started' → 'cache_check_done'│
│    - SSE: "캐시 확인 중..." (Redis Pub/Sub)                   │
│    ↓                                                          │
│ ② Node: sast (파일별 반복)                                    │
│    - MCP로 파일 읽기                                          │
│    - Claude API 분석 요청                                     │
│    - 취약점 JSON 파싱                                          │
│    - Backend API로 취약점 저장 요청                            │
│    - 체크포인트 업데이트 (파일별)                              │
│    - progress_log: 'sast_file_X_done' (파일당 1개)            │
│    - SSE: "5/10 파일 분석 완료"                               │
│    ↓                                                          │
│ ③ Node: dast (취약점 있을 시만)                               │
│    - Docker 컨테이너 생성                                      │
│    - 페이로드 실행                                             │
│    - 결과 판정                                                 │
│    - 실패 시 재시도 (최대 3회) — 각 시도마다 체크포인트          │
│    - progress_log: 'dast_vuln_X_attempt_Y'                   │
│    ↓                                                          │
│ ④ Node: patch                                                 │
│    - 취약점별 패치 코드 생성                                   │
│    - progress_log: 'patch_vuln_X_done'                       │
│    ↓                                                          │
│ ⑤ Node: report                                                │
│    - 최종 집계                                                │
│    - 사용자용 체크리스트 MD 생성                               │
│    - progress_log: 'session_completed'                        │
│    - agent_checkpoints 삭제 (완료됐으므로 불필요)              │
│    ↓                                                          │
│ ⑥ Node: notify                                                │
│    - SSE 'completed' 이벤트                                   │
│    - FCM Push (Android)                                       │
└──────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│ 정상 완료:                                                    │
│   - AnalysisSession status=completed                         │
│   - vulnerabilities 테이블에 최종 결과                        │
│   - 체크리스트 MD 다운로드 가능                                │
│                                                              │
│ 중단 발생 시 (예: AI Agent 크래시, 타임아웃):                  │
│   - agent_checkpoints 테이블에 마지막 State 보존              │
│   - status='interrupted'                                     │
│   - 재개 버튼 클릭 시 → PostgresSaver로 마지막 노드부터 재실행  │
└──────────────────────────────────────────────────────────────┘
```

---

## 5. 체크포인트 테이블 설계

### 5.1 `agent_checkpoints` — LangGraph 체크포인트

LangGraph `PostgresSaver`가 자동으로 관리하는 테이블. 수동 조작 금지.

```sql
-- LangGraph PostgresSaver 자동 생성 스키마 (v0.2.x)
CREATE TABLE agent_checkpoints (
    thread_id           UUID        NOT NULL,           -- = session_id
    checkpoint_ns       TEXT        NOT NULL DEFAULT '',
    checkpoint_id       TEXT        NOT NULL,
    parent_checkpoint_id TEXT,
    type                TEXT,                           -- 노드 유형
    checkpoint          JSONB       NOT NULL,           -- 전체 AgentState 직렬화
    metadata            JSONB       NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id)
);

CREATE INDEX idx_checkpoints_thread_id ON agent_checkpoints(thread_id, created_at DESC);
```

### 5.2 `analysis_progress_log` — 사용자용 진행 로그 (우리가 설계)

```sql
CREATE TABLE analysis_progress_log (
    id              BIGSERIAL       PRIMARY KEY,
    session_id      UUID            NOT NULL REFERENCES analysis_sessions(id) ON DELETE CASCADE,

    -- 단계 분류
    -- 'session_created', 'cache_check', 'sast_started',
    -- 'sast_file_done', 'dast_started', 'dast_vuln_attempt',
    -- 'patch_started', 'patch_done', 'report_generated',
    -- 'session_completed', 'session_interrupted', 'session_resumed'
    step_code       VARCHAR(50)     NOT NULL,
    step_order      INTEGER         NOT NULL,           -- 정렬용 순번

    -- 상세 정보
    step_label      VARCHAR(200)    NOT NULL,           -- 사용자 표시 문구
    target_detail   VARCHAR(500),                       -- 파일 경로, 취약점 ID 등
    status          VARCHAR(20)     NOT NULL,           -- 'started', 'done', 'failed', 'skipped'

    -- 진행률 스냅샷
    progress_pct    SMALLINT,                           -- 0~100

    -- 타임스탬프
    started_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,
    duration_ms     INTEGER,

    -- 에러 정보
    error_message   TEXT,

    -- 인덱스
    CONSTRAINT uq_session_step UNIQUE (session_id, step_code, target_detail)
);

CREATE INDEX idx_progress_log_session_id ON analysis_progress_log(session_id, step_order);
CREATE INDEX idx_progress_log_session_status ON analysis_progress_log(session_id, status);
```

### 5.3 Flyway 마이그레이션

```
V008__create_analysis_progress_log.sql
V009__create_agent_checkpoints_hint.sql   -- LangGraph 자동 생성이지만 초기 로딩 힌트
```

---

## 6. LangGraph Checkpointer 연동

### 6.1 AI Agent 측 설정

```python
# ai-agent/agent/pipeline/graph_builder.py
from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.graph import StateGraph
from .security_audit_graph import build_security_audit_graph
from .agent_state import AgentState
from ..config.settings import settings

# DB 연결 문자열
DB_URI = settings.DATABASE_URL

# PostgresSaver 싱글턴 (앱 시작 시 1회 초기화)
_checkpointer = None

def get_checkpointer():
    """PostgresSaver 싱글턴 반환"""
    global _checkpointer
    if _checkpointer is None:
        _checkpointer = PostgresSaver.from_conn_string(DB_URI)
        _checkpointer.setup()  # 테이블 자동 생성
    return _checkpointer

def get_compiled_graph():
    """체크포인터가 연결된 컴파일된 그래프 반환"""
    graph = build_security_audit_graph()
    return graph.compile(checkpointer=get_checkpointer())
```

### 6.2 분석 실행 시

```python
# ai-agent/api/routes/analyze.py
from agent.pipeline.graph_builder import get_compiled_graph

@router.post("/analyze")
async def analyze(request: AnalyzeRequest):
    graph = get_compiled_graph()

    # thread_id = session_id (중단·재개의 키)
    config = {"configurable": {"thread_id": str(request.session_id)}}

    initial_state = AgentState(
        session_id=request.session_id,
        project_id=request.project_id,
        file_paths=request.file_paths,
        vulnerabilities=[],
        retry_count=0,
    )

    # 비동기 실행 (체크포인트 자동 저장)
    async for event in graph.astream(initial_state, config=config):
        # 각 노드 완료마다 자동 체크포인트 저장
        # event: {"node_name": state_snapshot}
        pass

    return {"status": "completed"}
```

### 6.3 재개 실행 시

```python
@router.post("/resume/{session_id}")
async def resume(session_id: UUID):
    """중단된 세션을 마지막 체크포인트부터 재개"""
    graph = get_compiled_graph()
    config = {"configurable": {"thread_id": str(session_id)}}

    # 마지막 State 조회 (자동)
    last_state = graph.get_state(config)

    if last_state is None:
        raise HTTPException(404, "체크포인트 없음 — 처음부터 다시 시작해야 합니다")

    # None으로 실행하면 마지막 지점부터 자동 재개
    async for event in graph.astream(None, config=config):
        pass

    return {"status": "resumed"}
```

### 6.4 Backend 재개 API

```java
// Backend: AnalysisController
@PostMapping("/sessions/{sessionId}/resume")
public ApiResponse<Void> resumeSession(@PathVariable UUID sessionId,
                                        @AuthenticationPrincipal User user) {
    // 세션 소유자 검증
    AnalysisSession session = analysisService.getSession(sessionId, user.getId());

    // status = 'interrupted' 인지 확인
    if (!"interrupted".equals(session.getStatus())) {
        throw new BusinessException(ErrorCode.SESSION_NOT_RESUMABLE);
    }

    // 진행 로그에 '재개' 이벤트 기록
    progressLogService.log(sessionId, "session_resumed", "사용자 요청으로 재개");

    // AI Agent에 재개 요청
    aiAgentClient.resume(sessionId);

    return ApiResponse.ok();
}
```

---

## 7. 사용자용 체크리스트 MD 자동 생성

### 7.1 API 엔드포인트

```
GET /api/v1/analysis/sessions/{sessionId}/checklist
인증: 필요
Content-Type: text/markdown

→ 현재 진행 상태를 실시간으로 MD 형식으로 반환
```

### 7.2 서비스 구현

```java
// Backend: ChecklistMarkdownService.java
@Service
public class ChecklistMarkdownService {

    private final AnalysisProgressLogRepository progressLogRepo;
    private final AnalysisSessionRepository sessionRepo;
    private final VulnerabilityRepository vulnRepo;

    public String generateChecklistMarkdown(UUID sessionId) {
        AnalysisSession session = sessionRepo.findById(sessionId).orElseThrow();
        List<AnalysisProgressLog> logs = progressLogRepo
            .findBySessionIdOrderByStepOrder(sessionId);
        List<Vulnerability> vulns = vulnRepo.findBySessionId(sessionId);

        StringBuilder md = new StringBuilder();
        md.append("# 🛡️ SecureAI 보안 점검 진행 상황\n\n");
        md.append("**세션 ID**: `").append(sessionId).append("`\n");
        md.append("**프로젝트**: ").append(session.getProject().getName()).append("\n");
        md.append("**시작 시각**: ").append(session.getStartedAt()).append("\n");
        md.append("**현재 상태**: ").append(session.getStatus()).append("\n");
        md.append("**진행률**: ").append(session.getProgressPct()).append("%\n\n");

        md.append("---\n\n## 📋 점검 단계\n\n");

        // Phase 1: 파일 수집
        md.append("### 1단계 — 파일 수집 (MCP Filesystem)\n");
        appendChecklistItem(md, logs, "cache_check", "파일 목록 수집 및 캐시 확인");
        md.append("\n");

        // Phase 2: SAST 분석
        md.append("### 2단계 — SAST 코드 정적 분석\n");
        long sastStarted = logs.stream().filter(l -> "sast_started".equals(l.getStepCode())).count();
        long sastFileDone = logs.stream().filter(l -> "sast_file_done".equals(l.getStepCode())).count();
        int totalFiles = session.getFilesScanned();
        md.append(sastStarted > 0 ? "- [x] " : "- [ ] ")
          .append("SAST 분석 시작\n");
        md.append("- [").append(sastFileDone == totalFiles && totalFiles > 0 ? "x" : " ")
          .append("] 전체 파일 분석 (").append(sastFileDone).append("/").append(totalFiles).append(")\n");

        // 파일별 상세
        logs.stream()
            .filter(l -> "sast_file_done".equals(l.getStepCode()))
            .forEach(l -> md.append("  - [x] `").append(l.getTargetDetail())
                            .append("` (").append(l.getDurationMs()).append("ms)\n"));
        md.append("\n");

        // Phase 3: DAST (있는 경우)
        boolean hasDast = logs.stream().anyMatch(l -> l.getStepCode().startsWith("dast_"));
        if (hasDast) {
            md.append("### 3단계 — DAST 동적 분석\n");
            long dastDone = logs.stream().filter(l -> "dast_vuln_done".equals(l.getStepCode())).count();
            long dastTotal = vulns.stream().filter(v -> v.isApiRelated()).count();
            md.append("- [").append(dastDone == dastTotal && dastTotal > 0 ? "x" : " ")
              .append("] DAST 실행 (").append(dastDone).append("/").append(dastTotal).append(")\n\n");
        }

        // Phase 4: 패치 생성
        md.append("### 4단계 — 패치 제안 생성\n");
        long patchDone = logs.stream().filter(l -> "patch_done".equals(l.getStepCode())).count();
        md.append("- [").append(patchDone == vulns.size() ? "x" : " ")
          .append("] 패치 코드 생성 (").append(patchDone).append("/").append(vulns.size()).append(")\n\n");

        // Phase 5: 리포트
        md.append("### 5단계 — 최종 리포트\n");
        boolean reportDone = logs.stream().anyMatch(l -> "report_generated".equals(l.getStepCode()));
        md.append(reportDone ? "- [x] " : "- [ ] ").append("리포트 생성 완료\n\n");

        // 발견된 취약점 요약
        md.append("---\n\n## 🔍 발견된 취약점 요약\n\n");
        md.append("| 심각도 | 개수 | 패치 완료 |\n");
        md.append("|--------|------|----------|\n");
        appendSeverityRow(md, vulns, "critical", "🔴 Critical");
        appendSeverityRow(md, vulns, "high", "🟠 High");
        appendSeverityRow(md, vulns, "medium", "🟡 Medium");
        appendSeverityRow(md, vulns, "low", "🟢 Low");

        // 중단 시 안내
        if ("interrupted".equals(session.getStatus())) {
            md.append("\n---\n\n## ⚠️ 분석이 중단되었습니다\n\n");
            md.append("마지막 완료 단계: **").append(session.getCurrentStep()).append("**\n\n");
            md.append("- [ ] 분석 재개하기 → `POST /api/v1/analysis/sessions/")
              .append(sessionId).append("/resume`\n");
        }

        return md.toString();
    }

    private void appendChecklistItem(StringBuilder md, List<AnalysisProgressLog> logs,
                                      String stepCode, String label) {
        boolean done = logs.stream()
            .anyMatch(l -> l.getStepCode().equals(stepCode) && "done".equals(l.getStatus()));
        md.append(done ? "- [x] " : "- [ ] ").append(label).append("\n");
    }

    private void appendSeverityRow(StringBuilder md, List<Vulnerability> vulns,
                                    String severity, String label) {
        long total = vulns.stream().filter(v -> severity.equals(v.getSeverity())).count();
        long patched = vulns.stream()
            .filter(v -> severity.equals(v.getSeverity()) && "fixed".equals(v.getStatus()))
            .count();
        md.append("| ").append(label).append(" | ").append(total)
          .append(" | ").append(patched).append("/").append(total).append(" |\n");
    }
}
```

### 7.3 생성된 MD 예시

```markdown
# 🛡️ SecureAI 보안 점검 진행 상황

**세션 ID**: `7f3a9b21-4c5d-4e6f-8a9b-1c2d3e4f5a6b`
**프로젝트**: secureai-frontend
**시작 시각**: 2026-04-19T14:32:00Z
**현재 상태**: running
**진행률**: 65%

---

## 📋 점검 단계

### 1단계 — 파일 수집 (MCP Filesystem)
- [x] 파일 목록 수집 및 캐시 확인

### 2단계 — SAST 코드 정적 분석
- [x] SAST 분석 시작
- [ ] 전체 파일 분석 (7/10)
  - [x] `src/UserController.java` (2340ms)
  - [x] `src/AuthService.java` (1820ms)
  - [x] `src/LoginPage.tsx` (1560ms)
  - [x] `src/UserRepository.java` (980ms)
  - [x] `src/config/SecurityConfig.java` (1200ms)
  - [x] `src/utils/TokenUtil.java` (740ms)
  - [x] `src/Dashboard.tsx` (1340ms)

### 3단계 — DAST 동적 분석
- [ ] DAST 실행 (0/3)

### 4단계 — 패치 제안 생성
- [ ] 패치 코드 생성 (0/6)

### 5단계 — 최종 리포트
- [ ] 리포트 생성 완료

---

## 🔍 발견된 취약점 요약

| 심각도 | 개수 | 패치 완료 |
|--------|------|----------|
| 🔴 Critical | 3 | 0/3 |
| 🟠 High | 2 | 0/2 |
| 🟡 Medium | 1 | 0/1 |
| 🟢 Low | 0 | 0/0 |
```

### 7.4 프론트엔드 표시

```typescript
// frontend에서 실시간 MD 렌더링
import { marked } from 'marked';

function ProgressChecklist({ sessionId }: { sessionId: string }) {
  const [markdown, setMarkdown] = useState('');

  // SSE로 단계 변경 시마다 MD 재조회
  useSse(sessionId, {
    onProgress: async () => {
      const res = await fetch(`/api/v1/analysis/sessions/${sessionId}/checklist`);
      setMarkdown(await res.text());
    }
  });

  return (
    <div className="checklist-md"
         dangerouslySetInnerHTML={{ __html: marked(markdown) }} />
  );
}
```

---

## 8. 중단·재개 시나리오

### 8.1 시나리오 A — 정상 완료

```
1. 사용자: POST /analysis/sessions → 202 반환
2. AI Agent: 파이프라인 시작, 각 노드 후 agent_checkpoints 저장
3. 각 단계 시작/완료 시 analysis_progress_log 기록
4. Redis progressPct 갱신 → SSE로 전송
5. report_generated 로그 → status=completed
6. 24시간 후: agent_checkpoints 자동 삭제 (완료 세션)
```

### 8.2 시나리오 B — AI Agent 컨테이너 크래시

```
1. 파이프라인 실행 중 SAST 7/10 파일 완료 시점에 OOM 발생
2. Docker가 컨테이너 재시작
3. Backend는 Circuit Breaker로 장애 감지
4. AnalysisSession.status = 'interrupted' 업데이트
5. analysis_progress_log에 'session_interrupted' 기록
6. 사용자 화면에 "분석이 중단되었습니다. 재개하기" 버튼 표시
7. 사용자 클릭 → POST /sessions/{id}/resume
8. AI Agent: PostgresSaver에서 마지막 체크포인트 복원
9. 8번째 파일부터 분석 재개
10. 완료 시 정상 플로우 진행
```

### 8.3 시나리오 C — 사용자 의도적 중단

```
1. 사용자가 "분석 취소" 버튼 클릭
2. POST /sessions/{id}/cancel
3. Backend: AI Agent에 취소 시그널 전송
4. AI Agent: 현재 노드 완료 후 graph 중단
5. status = 'cancelled'
6. agent_checkpoints는 24시간 보관 후 삭제
   (사용자가 변심하여 재개할 수도 있음)
```

### 8.4 시나리오 D — DAST 타임아웃

```
1. DAST Docker 컨테이너 300초 초과
2. DockerSandboxManager가 컨테이너 강제 종료
3. dast_node가 실패 처리
4. LangGraph 조건부 엣지: 재시도 여부 판단 (최대 3회)
5. 3회 모두 실패 시: 해당 취약점만 'dast_failed' 표시, 다음 노드 진행
6. 체크리스트 MD에 표시: "- [ ] DAST 실행 실패 (3회 재시도)"
```

---

## 9. 데이터 수명주기 & 삭제 정책

| 데이터 | 보관 기간 | 삭제 주체 |
|-------|---------|----------|
| `agent_checkpoints` (완료 세션) | 24시간 | `ExpiredDataCleanupJob` |
| `agent_checkpoints` (중단 세션) | 7일 | 사용자 재개 유도 후 자동 정리 |
| `analysis_progress_log` | 세션과 동일 수명 (파티션) | 세션 삭제 시 CASCADE |
| `vulnerabilities` | 프로젝트 삭제까지 보존 | 프로젝트 삭제 시 CASCADE |
| `analysis_sessions` | 무기한 (비즈니스 이력) | 사용자 탈퇴 시 삭제 |
| 최종 리포트 파일 | 90일 | `ExpiredDataCleanupJob` |

### Cleanup Job 확장

```java
// ExpiredDataCleanupJob.java 추가 로직
@Scheduled(cron = "0 30 4 * * *")  // 매일 04:30
public void cleanupCheckpoints() {
    // 완료된 세션 체크포인트 24시간 후 삭제
    int deletedCompleted = jdbcTemplate.update("""
        DELETE FROM agent_checkpoints 
        WHERE thread_id IN (
            SELECT id FROM analysis_sessions 
            WHERE status = 'completed' 
              AND completed_at < NOW() - INTERVAL '24 hours'
        )
    """);

    // 중단된 세션 체크포인트 7일 후 삭제 (재개 포기로 간주)
    int deletedInterrupted = jdbcTemplate.update("""
        DELETE FROM agent_checkpoints 
        WHERE thread_id IN (
            SELECT id FROM analysis_sessions 
            WHERE status IN ('interrupted', 'cancelled')
              AND created_at < NOW() - INTERVAL '7 days'
        )
    """);

    log.info("체크포인트 정리 완료: 완료 {}건, 중단 {}건",
             deletedCompleted, deletedInterrupted);
}
```

---

*관련 문서: `01_ERD.md` (테이블 참조), `02_API_DESIGN.md` (resume API)*
