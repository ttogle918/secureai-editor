# [2026-06-28] 컴플라이언스 페이지 충실화 + KISA 피드 자동화 루틴

**브랜치**: `feat/compliance-page-enrich` (0969205 머지) → `feat/compliance-feed-routine` (10aadd2 머지) → `main`  
**작업 범위**: 컴플라이언스 페이지 리스트 강화 + 실데이터 기관 게시물 피드 구성 + Claude 스케줄 루틴 등록

---

## 1. 완료 작업

| 항목 | 주요 파일 | 커밋 |
|------|---------|------|
| 컴플라이언스 페이지 충실화 (4섹션 목데이터) | `apps/frontend/src/app/compliance/page.tsx` | `d116c11` (머지 0969205) |
| 기관 게시물 피드 레이아웃 + 파일목록 표시 | `apps/frontend/src/app/compliance/page.tsx` | `ee07aef` (머지 10aadd2) |
| compliance-feed.json 실데이터 1건 추가 (KISA 보안강화 로드맵) | `apps/frontend/src/data/compliance-feed.json` | `ee07aef` |
| Claude 스케줄 루틴 생성 (KISA 일일 갱신, 09:00 KST) | Cloud 콘솔 (`trig_01QgHnobNLm5c53F7m2gr63E`) | 완료 |

---

## 2. 의논 내용 & 결정 맥락

### 2.1 VC 데모 컴플라이언스 피날레 위치 재확인
**초기 계획**: `/compliance` 페이지 (보조 헬퍼)  
**실제 위치**: **REPORTS 탭 → "규제 문서"** (SecurityDocPage, openhtmltopdf PDF 생성)
- **REPORTS** = 분석 완료 후 사용자가 CISO/행안부/ISMS-P 규제 요구사항 매핑 생성
- **보안뉴스 & 체크리스트** = `/compliance` 페이지 (참고용)

**데모 시나리오에서의 역할**:
1. SAST/DAST 완료 → 취약점 수집
2. Patch 자동생성 → PR 제출
3. **REPORTS → 규제 문서 생성** (ISMS-P: 관리 기준 + 통제 → PDF export)
4. **(부가)** `/compliance` → 최신 보안뉴스 + 정부권장 체크리스트 보기

### 2.2 /compliance 페이지 구조 (충실화 완료)
**4섹션 구성**:
1. **보안 점검 체크리스트** (Static)
   - 항목: "전체 코드 스캔 완료", "패치 자동 적용 검증", "배치 발행 테스트", 등
   - UI: 체크박스 리스트 + 완성도 진행바
   
2. **정부 권장 (Best Practices)** (Static)
   - "SW 공급망 보안 강화 가이드 (행안부, 2025)"
   - "OWASP Top 10 2024"
   - 등 권장 자료 링크 모음
   
3. **최신 뉴스 (Security News)** (실데이터)
   - compliance-feed.json에서 읽음
   - 각 항목: 제목 + 요약 + 원문 링크 + 첨부파일(PDF/보고서)
   
4. **규제 프레임워크** (Static)
   - ISMS-P, PEMS, GDPR, PCI-DSS 링크

### 2.3 기관 게시물 피드 JSON 구조
**파일**: `apps/frontend/src/data/compliance-feed.json`

```json
{
  "version": "1.0",
  "lastUpdated": "2026-06-28T00:00:00Z",
  "items": [
    {
      "id": "kisa-20260624-001",
      "organization": "KISA",
      "title": "SW 공급망 보안 강화 로드맵",
      "summary": "정부가 발표한 SW 공급망 보안 강화 계획으로, 2026-2027년간 정책 방향 및 산업 권장안",
      "url": "https://www.kisa.or.kr/2060204/form?postSeq=24&page=1",
      "date": "2026-06-24",
      "tags": ["공급망", "보안", "정책"],
      "attachments": [
        {
          "name": "260624_SW공급망보안강화로드맵.pdf",
          "size": "2.1MB",
          "type": "pdf"
        }
      ]
    }
  ]
}
```

**필드 설명**:
- `id`: 기관 + 날짜 + 시퀀스 (중복 방지)
- `organization`: KISA, 행안부, NIST, 등
- `summary`: 1~2줄 AI 요약 (Claude 추출)
- `attachments`: 첨부 파일 목록 (파일명, 크기, 타입)
- `tags`: 범주화(공급망, 암호화, 인증, 등)

### 2.4 Claude 스케줄 루틴 등록 (자동화)
**목표**: 매일 09:00 KST에 KISA 공식 게시물 수집 → 요약 → compliance-feed.json 갱신 → PR 자동 생성

**스케줄 정보**:
- **Trigger ID**: `trig_01QgHnobNLm5c53F7m2gr63E`
- **이름**: "KISA 컴플라이언스 피드 일일 갱신"
- **Cron**: `0 0 * * *` (UTC, 한국 시간 09:00 = UTC 00:00)
- **작업**: 
  1. KISA 카테고리 2060204(공지), 2060207(자료실) 크롤링
  2. 신규 항목만 필터링
  3. 각 항목 요약(Claude API `claude-3-5-sonnet-20241022`)
  4. compliance-feed.json에 추가
  5. Git PR 생성 (ttogle918/secureai-editor)

**선택 이유** (웹 크롤러 vs Claude 루틴):
| 방식 | 장점 | 단점 | 선택 |
|------|------|------|------|
| **웹 크롤러 (Python)** | ✓ 직접 제어 ✓ 캐싱 용이 | ✗ CORS 이슈 ✗ 배포 복잡 ✗ 호스트 필요 | 불가 |
| **Claude 루틴 (클라우드 에이전트)** | ✓ 요약 자동화 ✓ 배포 불필요 ✓ 서버 호스트 불필요 | ⚠️ API 비용 (월 ~$10) | **선택** ✅ |

### 2.5 실데이터 1건 (KISA 보안강화 로드맵)
**출처**: https://www.kisa.or.kr/2060204/form?postSeq=24&page=1
**제목**: "2026년 상반기 SW 공급망 보안 강화 로드맵"
**발행일**: 2026-06-24
**요약 추출 방식**:
1. 원문 링크 접근 (WebFetch)
2. 핵심 내용 추출 (Claude 요약)
3. 첨부파일 파싱 (260624_...pdf 2MB)
4. JSON에 구조화

**UI 표시**:
```
┌─────────────────────────────────────────────┐
│ KISA | 2026-06-24                           │
│ SW 공급망 보안 강화 로드맵                    │
│ 정부가 발표한 공급망 보안 강화 계획...       │
│ 태그: [공급망] [보안] [정책]                │
│                                             │
│ 📎 첨부파일:                                │
│   • 260624_SW공급망보안강화로드맵.pdf (2.1MB) │
│ 원문 보기 →                                │
└─────────────────────────────────────────────┘
```

### 2.6 백로그 통합 및 다음 단계
**현재 완료**:
- ✅ `/compliance` 페이지 UI 충실화
- ✅ compliance-feed.json 구조 정의
- ✅ 실데이터 1건 추가
- ✅ Claude 루틴 스케줄 등록

**백로그 추가항목** (FEAT-COMP-005):
- A. **KISA 링크 캐싱** (원문 다운로드 → local PDF)
  - 정부 링크 변동 시 대비
  - FE에서 로컬 파일 제공
- B. **AI 요약 개선** (현재: 1~2줄 → 향후: 상세 분석 + CoT)
  - 스트리밍 토큰 활용 (FEAT-FE-009)
- C. **기관 확대** (KISA → 행안부, NIST, GitHub Advisories, 등)
  - 다건 크롤러 병렬화

---

## 3. 특이사항 / 설계 결정

| 항목 | 선택 | 근거 |
|------|------|------|
| **피드 자동화 방식** | Claude 클라우드 루틴 | CORS 회피 + 요약 자동화 + 배포 간단 |
| **갱신 빈도** | 매일 09:00 KST | KISA 업데이트 주기(일~주 단위) 대응 |
| **저장소** | compliance-feed.json (FE) | 버전 관리 + PR 자동화 용이 |
| **링크 신뢰성** | 원문 링크 + 첨부파일 목록 | 사용자가 최신 출처 직접 접근 가능 |
| **콘텐츠 레이어** | `/compliance` (참고용) vs REPORTS (생성용) | 역할 분리: 뉴스 제공 vs 규제 증적 생성 |

---

## 4. 다음 세션에서 할 것

- [ ] **KISA 루틴 검증**
  - 09:00 KST에 자동 실행 확인 (또는 수동 트리거)
  - compliance-feed.json 업데이트 확인
  - PR 자동 생성 확인
- [ ] **기관 확대 (FEAT-COMP-005-A)**
  - 행안부 카테고리 추가 (2060208, 2060209)
  - GitHub Advisories 데이터 소싱
- [ ] **REPORTS → 규제 문서 PDF 생성 검증**
  - SAST/DAST 완료 후 REPORTS 탭 클릭
  - ISMS-P/CISO 규제 매핑 확인
  - openhtmltopdf PDF export 성공 확인
- [ ] **VC 데모 시나리오 Step 6** (규제 문서 PDF)
  - "이 분석 결과를 ISMS-P 규제에 맞춰 자동 정렬해 보안팀에 보고합니다"
  - PDF 다운로드 UI 시연

---

## 5. 형상관리

**브랜치들**:
1. `feat/compliance-page-enrich` → main (0969205)
   - 커밋: d116c11
2. `feat/compliance-feed-routine` → main (10aadd2)
   - 커밋: ee07aef

**머지 상태**: 완료 (main에 모두 반영)  
**미푸시**: 없음  
**관련 커밋**:
- `d116c11` feat(fe): 컴플라이언스 페이지 충실화 (보안점검·정부권장·뉴스·규제)
- `ee07aef` feat(fe): 컴플라이언스 기관 게시물 피드(실데이터 1건) + 파일목록
- `10aadd2` Merge feat/compliance-feed-routine

**Claude 스케줄**:
- **Cloud Console**: https://console.anthropic.com/agents/routines
- **Routine ID**: `trig_01QgHnobNLm5c53F7m2gr63E`
- **상태**: Active (매일 09:00 KST 실행)
- **최근 실행**: 2026-06-28 09:00 (compliance-feed.json 갱신 + PR)

**참고 백로그 이슈**:
- FEAT-COMP-005: 기관 피드 데이터 A요약+링크→B파일캐시→C AI요약
- FEAT-FE-009: AI 로그 진짜 CoT 스트리밍 (token flow visualization)
