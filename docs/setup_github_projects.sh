#!/bin/bash
# =============================================================
# SecureAI — GitHub Projects 자동 등록 스크립트
# 사전 조건: GitHub CLI (gh) 설치 + gh auth login 완료
# 사용법: bash setup_github_projects.sh [OWNER] [REPO]
# 예시: bash setup_github_projects.sh myorg secureai
# =============================================================

set -e

OWNER="${1:-myorg}"
REPO="${2:-secureai}"
FULL_REPO="$OWNER/$REPO"

echo "=================================================="
echo " SecureAI GitHub Projects 자동 등록 시작"
echo " 레포지토리: $FULL_REPO"
echo "=================================================="

# --- 1. GitHub Projects v2 생성 ---
echo ""
echo "[1/5] 프로젝트 보드 생성 중..."

# Owner ID 가져오기 (User 또는 Organization 모두 대응)
OWNER_ID=$(gh api graphql -f owner="$OWNER" -f query='
  query($owner: String!) {
    repositoryOwner(login: $owner) {
      id
    }
  }
' --jq '.data.repositoryOwner.id')

# 프로젝트 생성 및 정보 추출 (한 번만 실행)
PROJECT_DATA=$(gh api graphql -f ownerId="$OWNER_ID" -f title="SecureAI Development Board" -f query='
  mutation($ownerId: ID!, $title: String!) {
    createProjectV2(input: {
      ownerId: $ownerId
      title: $title
    }) {
      projectV2 {
        id
        number
      }
    }
  }
')

# 프로젝트 정보 추출 (Python 사용 또는 grep)
PROJECT_ID=$(echo "$PROJECT_DATA" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['createProjectV2']['projectV2']['id'])" 2>/dev/null || \
            echo "$PROJECT_DATA" | grep -oP '(?<="id":")[^"]+' | head -n 1)
PROJECT_NUMBER=$(echo "$PROJECT_DATA" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['createProjectV2']['projectV2']['number'])" 2>/dev/null || \
                echo "$PROJECT_DATA" | grep -oP '(?<="number":)[0-9]+' | head -n 1)

if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" == "null" ]; then
  echo "  ❌ 프로젝트 정보를 추출하지 못했습니다. 응답 데이터: $PROJECT_DATA"
  exit 1
fi

echo "  ✅ 프로젝트 생성 완료 (ID: $PROJECT_ID, Number: $PROJECT_NUMBER)"

# --- 2. 레이블 생성 ---
echo ""
echo "[2/5] GitHub 레이블 생성 중..."

create_label() {
  local name="$1" color="$2" desc="$3"
  gh label create "$name" --color "$color" --description "$desc" --repo "$FULL_REPO" 2>/dev/null || \
  gh label edit "$name" --color "$color" --description "$desc" --repo "$FULL_REPO" 2>/dev/null || true
}

# 스프린트 레이블
create_label "sprint-0" "0075ca" "Sprint 0: 환경 세팅"
create_label "sprint-1" "0075ca" "Sprint 1: 인증·프로젝트"
create_label "sprint-2" "0075ca" "Sprint 2: AI Agent·MCP"
create_label "sprint-3" "0075ca" "Sprint 3: SAST·GitHub 기초"
create_label "sprint-4" "0075ca" "Sprint 4: 웹 UI·SSE"
create_label "sprint-5" "0075ca" "Sprint 5: GitHub Layer 2"
create_label "sprint-6" "0075ca" "Sprint 6: DAST 엔진"
create_label "sprint-7" "0075ca" "Sprint 7: 리포트·대시보드·Android"
create_label "sprint-8" "0075ca" "Sprint 8: 안정화"
create_label "sprint-9" "0075ca" "Sprint 9: Phase 3"

# 우선순위 레이블
create_label "critical"  "d73a4a" "🔴 Critical — 블로커"
create_label "high"      "e4781f" "🟠 High — 중요"
create_label "medium"    "f9c513" "🟡 Medium — 보통"
create_label "low"       "0e8a16" "🟢 Low — 낮음"

# 서비스 레이블
create_label "backend"      "5319e7" "Spring Boot 백엔드"
create_label "ai-agent"     "1d76db" "Python AI Agent"
create_label "mcp-server"   "0052cc" "MCP Server Node.js"
create_label "frontend"     "e99695" "Next.js 프론트엔드"
create_label "android"      "a2eeef" "Android Kotlin 앱"
create_label "dast-sandbox" "f9d0c4" "DAST 샌드박스"
create_label "infra"        "bfd4f2" "인프라 / DevOps"

# 기능 레이블
create_label "auth"         "c5def5" "인증 관련"
create_label "security"     "d93f0b" "보안 관련"
create_label "github-layer2" "0052cc" "GitHub 레포 스캔 (Layer 2)"
create_label "phase3"       "e4e669" "Phase 3 기능"

echo "  ✅ 레이블 생성 완료"

# --- 3. 마일스톤 생성 ---
echo ""
echo "[3/5] 마일스톤 생성 중..."

create_milestone() {
  local title="$1" due="$2" desc="$3"
  gh api repos/$FULL_REPO/milestones \
    -f title="$title" \
    -f due_on="${due}T00:00:00Z" \
    -f description="$desc" \
    --method POST > /dev/null 2>&1 || true
}

TODAY=$(date +%Y-%m-%d)
create_milestone "Sprint 0 — 환경 세팅"           "2026-05-02" "Week 01-02: 전체 서비스 docker compose up 하나로 실행"
create_milestone "Sprint 1 — 인증·프로젝트"        "2026-05-16" "Week 03-04: 회원가입/로그인/프로젝트 CRUD API"
create_milestone "Sprint 2 — AI Agent·MCP"        "2026-05-30" "Week 05-06: LangGraph 파이프라인 + MCP 단일 파일 분석"
create_milestone "Sprint 3 — SAST·GitHub 기초"    "2026-06-13" "Week 07-08: 전체 프로젝트 SAST + GitHub API 기반 스캔"
create_milestone "Sprint 4 — 웹 UI·SSE"          "2026-06-27" "Week 09-10: Monaco 에디터 + 취약점 실시간 표시"
create_milestone "Sprint 5 — GitHub Layer 2"      "2026-07-11" "Week 11-12: GitHub 레포 전체 완성 (히스토리, PR Webhook, SBOM)"
create_milestone "Sprint 6 — DAST 엔진"           "2026-07-25" "Week 13-14: Docker 샌드박스 DAST 실행"
create_milestone "Sprint 7 — 리포트·대시보드·Android" "2026-08-08" "Week 15-16: PDF 리포트 + 대시보드 + Android MVP"
create_milestone "Sprint 8 — 안정화"              "2026-08-22" "Week 17-18: 성능 최적화 + 보안 강화 + 런칭 준비"
create_milestone "Sprint 9 — Phase 3"             "2026-09-05" "Week 19-20: VSCode Extension + 지속 모니터링"

echo "  ✅ 마일스톤 생성 완료"

# --- 4. 이슈 생성 함수 ---
echo ""
echo "[4/5] 이슈 생성 중..."

create_issue() {
  local title="$1"
  local body="$2"
  local labels="$3"
  local milestone_title="$4"

  # 마일스톤 번호 조회
  local milestone_num=$(gh api repos/$FULL_REPO/milestones \
    --jq ".[] | select(.title == \"$milestone_title\") | .number" || echo "")

  local issue_url
  if [ -n "$milestone_num" ]; then
    issue_url=$(gh issue create \
      --repo "$FULL_REPO" \
      --title "$title" \
      --body "$body" \
      --label "$labels" \
      --milestone "$milestone_title" || echo "")
  else
    issue_url=$(gh issue create \
      --repo "$FULL_REPO" \
      --title "$title" \
      --body "$body" \
      --label "$labels" || echo "")
  fi

  # URL에서 이슈 번호 추출 (예: https://github.com/owner/repo/issues/123 -> 123)
  local issue_num=$(echo "$issue_url" | grep -oP '\d+$' || echo "")

  # 생성된 이슈를 프로젝트 보드에 추가
  if [ -n "$PROJECT_ID" ] && [ -n "$issue_num" ]; then
    gh project item-add "$PROJECT_NUMBER" --owner "$OWNER" --url "https://github.com/$FULL_REPO/issues/$issue_num" --format json > /dev/null 2>&1 || true
    echo "  ✅ 프로젝트 보드에 추가됨"
  fi

  echo "  📌 이슈 #$issue_num 생성: $title"
  echo "$issue_num"
}

# Sprint 0
create_issue \
  "[Sprint 0] 모노레포 Git 초기화 및 디렉토리 구조 생성" \
  "## 📌 목표\n전체 6개 서비스 디렉토리 골격 생성. GitHub 레포지토리 생성 및 branch 전략 설정.\n\n## ✅ 완료 조건\n\`git clone\` 후 \`make dev\`로 전체 컨테이너 실행 가능\n\n## 📋 하위 할일\n- [ ] GitHub 레포지토리 생성\n- [ ] 6개 서비스 디렉토리 골격 생성\n- [ ] \`.gitignore\` 작성\n- [ ] Branch protection rule 설정\n- [ ] \`Makefile\` 작성\n- [ ] \`README.md\` 기본 작성\n\n## 🔗 참고\n\`docs/06_REPOSITORY_STRUCTURE_V2.md\`" \
  "sprint-0,infra,critical" \
  "Sprint 0 — 환경 세팅"

create_issue \
  "[Sprint 0] Docker Compose 전체 서비스 구성" \
  "## 📌 목표\n6개 서비스 docker-compose.yml 정의. 네트워크 3개 분리.\n\n## ✅ 완료 조건\n\`docker compose up -d\` 후 전체 서비스 healthy\n\n## 📋 하위 할일\n- [ ] docker-compose.yml 전체 서비스 정의\n- [ ] PostgreSQL 15 헬스체크·볼륨\n- [ ] Redis 7 redis.conf 설정\n- [ ] 네트워크 3개 정의\n- [ ] .env.example 작성\n- [ ] docker-compose.prod.yml 초안\n\n## 🔗 참고\n\`docs/03_DOCKER_INFRA.md\`" \
  "sprint-0,infra,critical" \
  "Sprint 0 — 환경 세팅"

create_issue \
  "[Sprint 0] Spring Boot 프로젝트 초기화" \
  "## 📌 목표\nSpring Boot 4.0.5, Java 21, Gradle Kotlin DSL 초기화.\n\n## ✅ 완료 조건\n/actuator/health 200 응답, Flyway 마이그레이션 성공\n\n## 📋 하위 할일\n- [ ] Spring Initializr 프로젝트 생성\n- [ ] build.gradle.kts 의존성 정의\n- [ ] application.yml 설정 (Virtual Thread 포함)\n- [ ] Flyway V001~V005 마이그레이션\n- [ ] AsyncConfig Thread Pool 5종\n- [ ] GlobalExceptionHandler + ErrorCode" \
  "sprint-0,backend,critical" \
  "Sprint 0 — 환경 세팅"

create_issue \
  "[Sprint 0] Python AI Agent 서비스 초기화" \
  "## 📌 목표\nFastAPI, LangGraph, Anthropic SDK 초기화.\n\n## ✅ 완료 조건\nGET /health 200, LangSmith 연결 확인\n\n## 📋 하위 할일\n- [ ] requirements.txt 의존성 정의\n- [ ] main.py FastAPI 앱\n- [ ] config/settings.py Pydantic Settings\n- [ ] internal_key_auth.py 미들웨어\n- [ ] langsmith_tracer.py 설정\n- [ ] Dockerfile 작성" \
  "sprint-0,ai-agent,critical" \
  "Sprint 0 — 환경 세팅"

create_issue \
  "[Sprint 0] MCP Server 초기화 (Node.js)" \
  "## 📌 목표\n@modelcontextprotocol/sdk MCP Server. Filesystem Tool 4개.\n\n## ✅ 완료 조건\nAI Agent read_file Tool 호출 시 파일 내용 반환\n\n## 📋 하위 할일\n- [ ] package.json + TypeScript 설정\n- [ ] src/index.ts MCP Server (stdio 모드)\n- [ ] Filesystem Tool 4개 구현\n- [ ] path_validator.ts 경로 탈출 방지\n- [ ] file_filter.ts 바이너리·대용량 필터\n- [ ] AI Agent stdio 연결 테스트" \
  "sprint-0,mcp-server,high" \
  "Sprint 0 — 환경 세팅"

create_issue \
  "[Sprint 0] Next.js 프론트엔드 초기화" \
  "## 📌 목표\nNext.js 15, TypeScript strict, Tailwind 다크 테마 초기화.\n\n## ✅ 완료 조건\nlocalhost:3000 SecureAI 다크 테마 표시\n\n## 📋 하위 할일\n- [ ] Next.js 15 App Router 프로젝트\n- [ ] Tailwind 다크 테마 색상 토큰\n- [ ] Axios 인스턴스 기본 설정\n- [ ] Zustand 스토어 골격\n- [ ] TypeScript 타입 파일\n- [ ] 루트 레이아웃" \
  "sprint-0,frontend,high" \
  "Sprint 0 — 환경 세팅"

create_issue \
  "[Sprint 0] GitHub Actions CI 파이프라인 기본 설정" \
  "## 📌 목표\nbackend, ai-agent, frontend CI 워크플로우.\n\n## 📋 하위 할일\n- [ ] ci-backend.yml\n- [ ] ci-ai-agent.yml\n- [ ] ci-frontend.yml\n- [ ] Branch Protection CI 연결" \
  "sprint-0,infra,medium" \
  "Sprint 0 — 환경 세팅"

# Sprint 1~9 핵심 이슈들 (간략화)
create_issue "[Sprint 1] JWT 인증 시스템 구현 (Spring Boot)" \
  "## 📌 목표\n회원가입, 로그인, Access/Refresh Token Rotation, 이메일 인증.\n\n## ✅ 완료 조건\nPostman 로그인→토큰→갱신→로그아웃 전 과정 성공\n\n## 📋 하위 할일\n- [ ] User.java, Plan.java 엔티티 + Flyway V002, V003\n- [ ] AuthService.java (Bcrypt rounds=12, 5회 실패 잠금)\n- [ ] TokenService.java JWT Rotation\n- [ ] JwtAuthenticationFilter.java\n- [ ] RefreshToken 엔티티 + Repository\n- [ ] AuthController 전체 엔드포인트\n- [ ] EmailService @Async 이메일 발송\n- [ ] 단위 테스트 (토큰·잠금 정책)" \
  "sprint-1,backend,critical,auth" "Sprint 1 — 인증·프로젝트"

create_issue "[Sprint 1] GitHub OAuth 연동" \
  "## 📌 목표\nGitHub OAuth App. 코드→토큰→사용자 정보 교환. AES-256-GCM 암호화 저장.\n\n## ✅ 완료 조건\nGitHub 로그인 → SecureAI 계정 생성·로그인 성공\n\n## 📋 하위 할일\n- [ ] GitHub OAuth App 등록\n- [ ] AesEncryptionConverter.java\n- [ ] GitHubOAuthService.java\n- [ ] AuthController 콜백 엔드포인트\n- [ ] 프론트엔드 OAuth 버튼 + 콜백 페이지" \
  "sprint-1,backend,frontend,critical,auth" "Sprint 1 — 인증·프로젝트"

create_issue "[Sprint 1] 플랜 체계 및 Rate Limit 구현" \
  "## 📌 목표\n4개 플랜 시드. PlanChecker 빈. Redis Rate Limit.\n\n## 📋 하위 할일\n- [ ] Flyway V021 plans 시드\n- [ ] PlanChecker.java\n- [ ] RateLimitInterceptor.java\n- [ ] AuditLogAspect.java" \
  "sprint-1,backend,critical,security" "Sprint 1 — 인증·프로젝트"

create_issue "[Sprint 1] 프로젝트 CRUD API" \
  "## 📌 목표\n프로젝트 생성/조회/수정/삭제. 팀 멤버 관리.\n\n## 📋 하위 할일\n- [ ] Project.java, TeamMember.java 엔티티\n- [ ] ProjectService.java\n- [ ] ProjectController.java\n- [ ] @EntityGraph N+1 방지\n- [ ] 소프트 딜리트 + @Async 하드 딜리트" \
  "sprint-1,backend,high" "Sprint 1 — 인증·프로젝트"

create_issue "[Sprint 2] LangGraph 보안 감사 그래프 구축" \
  "## 📌 목표\nsecurity_audit_graph.py 그래프 정의. LangSmith 트레이싱 연결.\n\n## ✅ 완료 조건\n빈 AgentState 그래프 컴파일 성공, LangSmith 추적 확인\n\n## 📋 하위 할일\n- [ ] agent_state.py TypedDict\n- [ ] security_audit_graph.py 노드·엣지\n- [ ] graph_builder.py 컴파일·캐싱\n- [ ] 조건부 엣지 3개\n- [ ] LangSmith 연결" \
  "sprint-2,ai-agent,critical" "Sprint 2 — AI Agent·MCP"

create_issue "[Sprint 2] MCP Filesystem Tool → SAST 노드 연동" \
  "## 📌 목표\nMCP Tool로 파일 읽기 → Claude API 분석 → 취약점 JSON 파싱.\n\n## ✅ 완료 조건\n취약한 Java 파일 입력 → SQL Injection 취약점 반환\n\n## 📋 하위 할일\n- [ ] mcp_filesystem_tools.py Tool 3개\n- [ ] mcp_client.py stdio 연결\n- [ ] SAST 프롬프트 작성\n- [ ] claude_client.py Anthropic SDK 래퍼\n- [ ] response_parser.py JSON 복구\n- [ ] sast_node.py + cache_check_node.py" \
  "sprint-2,ai-agent,mcp-server,critical" "Sprint 2 — AI Agent·MCP"

create_issue "[Sprint 2] Spring Boot ↔ AI Agent HTTP 연동 & SSE 브릿지" \
  "## 📌 목표\nAiAgentClient Circuit Breaker. 분석 세션 API (202). Redis Pub/Sub SSE 브릿지.\n\n## ✅ 완료 조건\n분석 요청 → AI Agent 시작 → Redis 이벤트 발행 확인\n\n## 📋 하위 할일\n- [ ] AnalysisSession.java + Flyway V006\n- [ ] AnalysisService.java\n- [ ] AiAgentClient.java Circuit Breaker\n- [ ] RedisPublisher, RedisSubscriber\n- [ ] SseEmitterService.java\n- [ ] AnalysisController.java SSE 엔드포인트\n- [ ] ai-agent analyze.py 라우트" \
  "sprint-2,backend,ai-agent,critical" "Sprint 2 — AI Agent·MCP"

create_issue "[Sprint 3] GitHub 레포지토리 API 기반 코드 스캔 (Layer 2 — 1단계)" \
  "## 📌 목표\nGitHub API로 저장소 파일 조회 → SAST. API rate limit 처리.\n\n## ✅ 완료 조건\nGitHub URL 입력 → 자동 파일 조회 → SAST 완료\n\n## 📋 하위 할일\n- [ ] mcp-server get_repo_contents.ts MCP Tool\n- [ ] mcp_github_tools.py AI Agent Tool 래퍼\n- [ ] GitHubRestClient.java\n- [ ] GitHubApiService.java\n- [ ] source_type=github 분기 처리\n- [ ] Rate limit 429 대응\n- [ ] 바이너리·대용량 파일 제외" \
  "sprint-3,backend,ai-agent,mcp-server,critical,github-layer2" "Sprint 3 — SAST·GitHub 기초"

create_issue "[Sprint 5] GitHub 커밋 히스토리 시크릿 스캔" \
  "## 📌 목표\n커밋 히스토리 전체 diff → 시크릿 패턴 탐지 (삭제된 이력 포함).\n\n## ✅ 완료 조건\n과거 커밋 삭제된 API 키 탐지 → 취약점 등록\n\n## 📋 하위 할일\n- [ ] list_commits.ts MCP Tool\n- [ ] get_commit_diff.ts MCP Tool\n- [ ] mcp_github_tools.py 커밋 Tool 래퍼\n- [ ] 시크릿 탐지 프롬프트 + 전용 노드\n- [ ] CommitHistoryScanner.java @Async 페이지네이션\n- [ ] 병렬 처리 최적화" \
  "sprint-5,backend,ai-agent,mcp-server,critical,github-layer2" "Sprint 5 — GitHub Layer 2"

create_issue "[Sprint 5] GitHub PR Webhook 자동 보안 리뷰" \
  "## 📌 목표\nHMAC 검증. PR 생성 시 변경파일 SAST → PR 코멘트 자동 등록.\n\n## ✅ 완료 조건\nPR 생성 → 자동 SAST → PR 보안 리뷰 코멘트\n\n## 📋 하위 할일\n- [ ] GitHubWebhookController.java HMAC 검증\n- [ ] GitHubWebhookService.java PR 처리\n- [ ] 변경 파일만 선택 스캔\n- [ ] create_pr_comment.ts MCP Tool\n- [ ] PrReviewHistory.java + Flyway V013\n- [ ] GitHub Check Run API 연동" \
  "sprint-5,backend,mcp-server,critical,github-layer2" "Sprint 5 — GitHub Layer 2"

create_issue "[Sprint 6] Docker 샌드박스 DAST 컨테이너" \
  "## 📌 목표\nDAST 샌드박스 5개 익스플로잇. DockerSandboxManager 동적 생성·삭제.\n\n## ✅ 완료 조건\nDAST 요청 → Docker 컨테이너 생성→실행→결과→삭제\n\n## 📋 하위 할일\n- [ ] executors/ 5개 익스플로잇 구현\n- [ ] dast_runner.py 완성\n- [ ] DockerSandboxManager.java\n- [ ] ContainerConfig.java 격리 설정\n- [ ] ExploitResult.java + Flyway V008\n- [ ] 300초 타임아웃 강제 종료" \
  "sprint-6,backend,dast-sandbox,critical" "Sprint 6 — DAST 엔진"

create_issue "[Sprint 7] Android 프로젝트 초기화 & 인증" \
  "## 📌 목표\nKotlin + Compose + Hilt. 인증서 피닝. EncryptedSharedPreferences.\n\n## ✅ 완료 조건\nAndroid 로그인 성공 → 프로젝트 목록 진입\n\n## 📋 하위 할일\n- [ ] Android 프로젝트 생성\n- [ ] NetworkModule.kt 인증서 피닝\n- [ ] TokenStorage.kt EncryptedSharedPreferences\n- [ ] LoginScreen.kt, RegisterScreen.kt\n- [ ] AuthViewModel.kt + AuthRepository.kt" \
  "sprint-7,android,critical" "Sprint 7 — 리포트·대시보드·Android"

create_issue "[Sprint 7] FCM Push & OkHttp SSE (Android)" \
  "## 📌 목표\nFCM Push(background) + OkHttp SSE(foreground) 이중 전략.\n\n## 📋 하위 할일\n- [ ] Firebase 프로젝트 + google-services.json\n- [ ] FcmPushService.java Spring Boot\n- [ ] SecureAiFcmService.kt\n- [ ] SseClient.kt Flow<SseEvent>\n- [ ] AnalysisViewModel.kt FCM/SSE 이중 처리" \
  "sprint-7,android,backend,high" "Sprint 7 — 리포트·대시보드·Android"

echo ""
echo "  ✅ 이슈 생성 완료"

# --- 5. 완료 ---
echo ""
echo "[5/5] 설정 완료!"
echo ""
echo "=================================================="
echo " ✅ GitHub Projects 자동 등록 완료!"
echo " 📎 https://github.com/orgs/$OWNER/projects"
echo "=================================================="
echo ""
echo "📌 다음 단계:"
echo "  1. GitHub Projects 페이지에서 이슈를 칸반 컬럼에 배치하세요"
echo "  2. 각 이슈에 Story Points 커스텀 필드를 입력하세요"
echo "  3. Sprint 시작 시 해당 이슈를 'In Progress'로 이동하세요"
echo ""
