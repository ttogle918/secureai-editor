# [2026-05-13] 작업 세션 요약

**브랜치**: `feat/sprint4` → `feat/frontend-ui` (반응형 작업) → `feat/sprint4` (복귀)  
**작업 범위**: 반응형 UI 완성, Docker 인프라 디버깅, 토큰 사용량 추적 기능 추가

---

## 1. 완료 작업

| 항목 | 주요 파일 |
|------|---------|
| 반응형 CSS 유틸리티 클래스 추가 | `apps/frontend/src/app/globals.css` |
| KPI 그리드·차트 그리드 반응형 전환 | `DashboardPage.tsx` |
| 헤더 심각도 필터·파이프라인 배지 반응형 | `AppHeader.tsx` |
| MobileBottomNav 에디터 페이지 연동 | `apps/frontend/src/app/editor/page.tsx` |
| `gradlew` 실행 권한 수정 (CI 픽스) | `apps/backend/gradlew` (100644→100755) |
| Docker Compose Netty DNS 픽스 | `docker-compose.yml` |
| Claude API 토큰 사용량 반환 | `apps/ai_engine/agent/claude_client.py` |
| AgentState token_usage 필드 추가 | `apps/ai_engine/agent/agent_state.py` |
| SAST 노드 파일별 토큰 누적 | `apps/ai_engine/agent/nodes/sast_node.py` |
| completed SSE 이벤트에 token_usage 포함 | `apps/ai_engine/api/routes/analyze.py` |
| ProgressEvent 타입 token_usage 추가 | `apps/frontend/src/hooks/useSse.ts` |
| 분석 완료 토스트 토큰 상세 표시 | `AppHeader.tsx` |

---

## 2. 의논 내용 & 결정 맥락

### 반응형 웹 디자인 전략

기존 코드가 전부 인라인 `style={{}}` 방식이라 컴포넌트 구조 재작성 없이 반응형을 적용하려면 CSS 클래스 접근법이 유일한 방법. 색상·폰트 등 비구조적 속성은 인라인으로 유지하고, 레이아웃(display, grid-template-columns)만 className으로 교체.

```
globals.css에 추가된 반응형 클래스:
- .kpi-grid     : 2열(모바일) → 3열(≥600px) → 5열(≥1024px)
- .chart-grid   : 1열(모바일) → 1:1.6 비율 2열(≥768px)
- .header-sev-filters    : ≥768px에서만 표시
- .header-pipeline-badges: ≥900px에서만 표시
- .header-export-btn     : ≥1100px에서만 표시
- .mobile-only           : <768px에서만 표시 (MobileBottomNav 감싸는 div)
- .pb-mobile-nav         : 모바일에서 하단 nav 높이만큼 padding-bottom 확보
```

`MobileBottomNav` 컴포넌트는 이미 구현돼 있었으나 `editor/page.tsx`에 연결이 안 돼 있었음 → `mobileScreen` 상태 + `handleMobileNav` 콜백 추가하여 완성.

### CI 실패 원인 및 수정 — gradlew 실행 권한

GitHub Actions Ubuntu 러너에서 `./gradlew: Permission denied (exit code 126)` 발생. Docker 빌드 실패가 아니라 **git 파일 권한** 문제.

- Windows git은 execute bit(100755)를 보존하지 않아 `gradlew`가 `100644`로 저장됨
- Ubuntu 환경에서는 실행 권한 없음 → CI 실패
- 수정: `git update-index --chmod=+x apps/backend/gradlew` → 커밋 `5f3d805`

### Docker Redis 크래시 루프 디버깅

백엔드가 `Unable to connect to Redis (NXDOMAIN)` 오류로 반복 재시작. 두 가지 원인이 복합 작용:

**원인 1 — 로컬 Redis가 포트 6379 선점**  
사용자 PC에 자동 시작 Redis가 설치돼 있어 Docker Redis 컨테이너가 호스트 포트 바인딩에 실패.  
`docker compose ps`에서 Redis가 `0.0.0.0:6379->6379` 대신 `6379/tcp`만 표시된 게 증거.

**원인 2 — Lettuce/Netty async DNS resolver**  
Lettuce(Redis Java 클라이언트)는 Netty 자체 async DNS resolver를 사용. Docker 내부 DNS(127.0.0.11)가 아닌 외부 DNS 서버를 쿼리해서 `redis` 서비스명을 `NXDOMAIN`으로 해석.  
PostgreSQL은 JDBC(JVM resolver)를 써서 정상이지만 Redis는 Lettuce라 영향 받음.

**수정**: `docker-compose.yml` backend 환경변수에 JVM 플래그 추가  
```yaml
JAVA_TOOL_OPTIONS: "-Djava.net.preferIPv4Stack=true"
```
이 플래그로 Netty가 JVM DNS resolver를 경유하게 되어 Docker 내부 DNS 정상 동작.

볼륨 초기화도 겸해 `docker compose down -v` 실행 (DB 데이터 리셋).

### 토큰 사용량 추적 설계

Claude API 응답의 `response.usage`에는 4가지 필드가 있음:
- `input_tokens`: 일반 입력 토큰 (full price)
- `output_tokens`: 출력 토큰
- `cache_creation_input_tokens`: 캐시에 쓴 토큰 (1.25x — 첫 호출만)
- `cache_read_input_tokens`: 캐시에서 읽은 토큰 (0.1x — 90% 절감)

데이터 흐름:
```
claude_client.analyze_for_sast()
  → (raw_text, usage) 튜플 반환
  → _analyze_chunks()에서 청크별 누적
  → sast_node()에서 파일별 state["token_usage"]에 합산
  → aggregate_node 이벤트 → SSE completed payload
  → 프론트 toast 2개:
      1. "분석 완료 — 취약점 N개 · Xk 토큰"
      2. "토큰 상세 — 입력 X / 출력 X / 캐시쓰기 X / 캐시읽기 X"
```

Prompt Caching 효과를 수치로 볼 수 있어 모델별 비용 예측에 활용 가능.  
Haiku 기준 `cache_read_input_tokens`가 늘수록 실질 비용이 크게 줄어듦 (10% 가격).

---

## 3. 버그 수정

| 버그 | 원인 | 수정 |
|------|------|------|
| CI `./gradlew: Permission denied` | Windows git이 execute bit 미보존 | `git update-index --chmod=+x` |
| 백엔드 크래시 루프 (NXDOMAIN) | Netty DNS resolver + 로컬 Redis 포트 충돌 | `JAVA_TOOL_OPTIONS` + 로컬 Redis 종료 |

---

## 4. 미해결 / 다음 세션

- [ ] **로컬 Redis 자동 시작 비활성화** — Windows 서비스 또는 WSL에서 Redis 자동 시작 설정 확인 후 비활성화
- [ ] **`docker compose up --build -d` 재실행** — `down -v` 후 아직 재기동 안 함
- [ ] **분석 후 토큰 표시 검증** — 실제 분석 실행하여 토스트에 토큰 수치 노출 확인
- [ ] **`feat/frontend-ui` PR 머지** — 반응형 UI + CI 픽스 커밋 포함, 아직 미푸시
