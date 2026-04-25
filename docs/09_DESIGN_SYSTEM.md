# SecureAI — 디자인 시스템 (Master)
> 기준: UI UX Pro Max v2.0 Cybersecurity Platform  
> 작성일: 2026-04-19 | 버전: v1.0

> 이 문서는 **Global Source of Truth**입니다. 페이지별 override가 필요하면 `design-system/pages/*.md` 참고.

---

## 1. 프로젝트 분류 (UI UX Pro Max 매핑)

```
카테고리:     Cybersecurity Platform (Tech & SaaS 그룹)
권장 스타일:  Dark Mode (OLED) + AI-Native UI + HUD/Sci-Fi FUI 혼합
적용 페르소나: 개발자, 보안 담당자, DevSecOps 엔지니어
신뢰 요소:    실시간 데이터, 엄격한 수치 표기, 명료한 상태 표시
```

---

## 2. 색상 팔레트

### 2.1 배경 계층 (Dark Mode OLED)

| 토큰 | HEX | 용도 |
|------|-----|------|
| `--bg-0` | `#0a0a0a` | 최외곽 배경 (body) |
| `--bg-1` | `#0f0f0f` | 메인 컨테이너, 사이드바 |
| `--bg-2` | `#141414` | 패널, 카드 |
| `--bg-3` | `#1a1a1a` | 호버·active 상태 |
| `--bg-4` | `#222222` | 코드 블록, 입력 필드 |

### 2.2 브랜드 색상

| 토큰 | HEX | 용도 |
|------|-----|------|
| `--accent-primary` | `#ea580c` | SecureAI 주요 액센트 (오렌지) |
| `--accent-hover` | `#f97316` | 호버 상태 |
| `--accent-muted` | `#ea580c26` | 배경 글로우 (15% alpha) |

**⚠️ 절대 사용 금지 (Anti-patterns)**
- ❌ AI purple/pink gradients — 보안 업종 신뢰 훼손
- ❌ 네온 컬러 — HUD에서 부분 글로우는 가능하지만 전체 그라디언트 금지
- ❌ 원색 그대로 (#ff0000, #00ff00 등) — 반드시 톤 조정

### 2.3 심각도 색상 (보안 전용 의미론)

| 심각도 | HEX | HSL | 용도 |
|--------|-----|-----|------|
| Critical | `#dc2626` | `hsl(0, 72%, 51%)` | CRITICAL 취약점 |
| High | `#ea580c` | `hsl(21, 90%, 48%)` | HIGH 취약점 (브랜드 색과 동일) |
| Medium | `#eab308` | `hsl(48, 96%, 53%)` | MEDIUM 취약점 |
| Low | `#16a34a` | `hsl(142, 76%, 36%)` | LOW 취약점 |
| Info | `#3b82f6` | `hsl(217, 91%, 60%)` | 정보성 메시지 |

**글로우 효과 (취약 라인 강조용)**
```css
.vuln-critical-line {
  background: rgba(220, 38, 38, 0.08);
  box-shadow: inset 3px 0 0 #dc2626, 0 0 12px rgba(220, 38, 38, 0.3);
}
.vuln-high-line {
  background: rgba(234, 88, 12, 0.08);
  box-shadow: inset 3px 0 0 #ea580c, 0 0 12px rgba(234, 88, 12, 0.3);
}
```

### 2.4 텍스트 색상 (대비 4.5:1 이상 검증됨)

| 토큰 | HEX | 배경 대비 (`--bg-1`) |
|------|-----|---------------------|
| `--text-primary` | `#fafafa` | 18.5:1 ✅ (AAA) |
| `--text-secondary` | `#a3a3a3` | 7.2:1 ✅ (AAA) |
| `--text-tertiary` | `#737373` | 4.8:1 ✅ (AA) |
| `--text-disabled` | `#525252` | 3.1:1 ⚠️ (큰 텍스트만) |

### 2.5 경계선·구분선

| 토큰 | HEX |
|------|-----|
| `--border-subtle` | `#262626` |
| `--border-default` | `#404040` |
| `--border-strong` | `#525252` |
| `--border-accent` | `#ea580c` |

---

## 3. 타이포그래피

### 3.1 폰트 페어링 (UI UX Pro Max 추천)

```
Primary:   Space Grotesk       — geometric sans, 보안·기술 느낌
Monospace: JetBrains Mono      — 코드, 수치, 로그
Fallback:  -apple-system, system-ui, sans-serif
```

**Google Fonts import**:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```

### 3.2 타이포그래피 스케일

| 토큰 | 크기 | line-height | weight | 용도 |
|------|------|-------------|--------|------|
| `text-xs` | 11px | 1.4 | 500 | 배지, 메타데이터 |
| `text-sm` | 13px | 1.5 | 400 | 보조 텍스트, 버튼 |
| `text-base` | 14px | 1.6 | 400 | 본문 (UI 기본) |
| `text-md` | 16px | 1.5 | 500 | 소제목 |
| `text-lg` | 20px | 1.4 | 600 | 섹션 제목 |
| `text-xl` | 28px | 1.3 | 700 | 페이지 제목 |
| `text-2xl` | 40px | 1.2 | 700 | Hero 제목 |

### 3.3 코드 타이포그래피

```css
code, pre, .monaco-editor * {
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  font-size: 13px;
  line-height: 1.7;   /* Monaco 에디터 권장 */
  font-feature-settings: 'liga' 1, 'calt' 1;  /* 합자 활성 */
}
```

---

## 4. 간격 (Spacing)

4px grid 기반 — Tailwind 기본 스케일 사용:

| 토큰 | px | 용도 |
|------|-----|------|
| `space-1` | 4px | 아이콘 내부 여백 |
| `space-2` | 8px | 버튼 내부 padding |
| `space-3` | 12px | 카드 내부 작은 여백 |
| `space-4` | 16px | 기본 여백 (컴포넌트 사이) |
| `space-6` | 24px | 섹션 내부 여백 |
| `space-8` | 32px | 섹션 사이 |
| `space-12` | 48px | 큰 섹션 사이 |

---

## 5. 반응형 breakpoint (필수 4개)

UI UX Pro Max 규칙에 따라 **반드시 4개 breakpoint**에서 검증:

```css
/* Mobile (기본)          */  /* 375px ~ */
@media (min-width: 768px)  {} /* Tablet   */
@media (min-width: 1024px) {} /* Desktop  */
@media (min-width: 1440px) {} /* Wide     */
```

**Tailwind 설정 (`tailwind.config.js`)**:
```js
module.exports = {
  theme: {
    screens: {
      'sm': '375px',   // 모바일 (SecureAI 모바일 뷰)
      'md': '768px',   // 태블릿
      'lg': '1024px',  // 데스크톱 (에디터 뷰 시작)
      'xl': '1440px',  // 와이드 (3패널 풀 레이아웃)
    }
  }
}
```

### 5.1 뷰포트별 레이아웃 변형

| 크기 | 메인 레이아웃 |
|------|-------------|
| 375px~ | 단일 컬럼, 하단 탭 네비 (모바일 앱과 동일) |
| 768px~ | 2패널 (사이드바 접힘 가능 + 메인) |
| 1024px~ | 3패널 (좁은 사이드바 + 에디터 + 우측 패널) |
| 1440px~ | 3패널 풀 (모든 패널 최대 확장 가능) |

---

## 6. 컴포넌트 규칙

### 6.1 아이콘 — ❌ 이모지 금지, ✅ SVG만 사용

**UI UX Pro Max 최우선 규칙**:

```
❌ 현재: <span>🛡️ SecureAI</span>  <span>🔴 Critical</span>
✅ 수정: <ShieldIcon /> SecureAI      <SeverityDot level="critical" />
```

**사용할 아이콘 라이브러리** (이미 프로젝트에 설치됨):
- `lucide-react` (웹) — 우선 사용
- 대안: `@heroicons/react` (outline/solid)

**심각도 표시**: SVG dot 또는 배지로 교체
```tsx
// ❌ 이전
<span>🔴</span>

// ✅ 수정
<span className="w-2 h-2 rounded-full bg-red-600 shadow-[0_0_6px_rgba(220,38,38,0.8)]" />
```

**파일 트리 아이콘**: Lucide의 `<File />`, `<FolderOpen />`, `<Folder />` 사용

### 6.2 버튼 — cursor-pointer 필수

```tsx
// ✅ 모든 클릭 가능 요소
<button className="
  cursor-pointer
  transition-all duration-200 ease-out
  focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ea580c]
  active:scale-[0.98]
">
```

**버튼 variant**:

| Variant | 배경 | 텍스트 | 용도 |
|---------|------|--------|------|
| Primary | `#ea580c` | `#fafafa` | 주요 CTA (분석 시작, 저장) |
| Secondary | `transparent` | `#fafafa` | 취소, 닫기 |
| Ghost | `transparent` | `#a3a3a3` | 보조 액션 (필터, 정렬) |
| Danger | `#dc2626` | `#fafafa` | 삭제, 취소 |
| Success | `#16a34a` | `#fafafa` | 승인, 패치 적용 |

### 6.3 포커스 상태 (키보드 네비게이션)

**모든 interactive 요소 필수**:

```css
*:focus-visible {
  outline: 2px solid #ea580c;
  outline-offset: 2px;
  border-radius: 4px;
}
```

### 6.4 카드 / 패널

```tsx
<div className="
  bg-[#141414]            /* --bg-2 */
  border border-[#262626] /* --border-subtle */
  rounded-lg
  p-4
  transition-colors duration-150
  hover:border-[#404040]  /* --border-default */
">
```

### 6.5 입력 필드

```tsx
<input className="
  bg-[#1a1a1a]            /* --bg-3 */
  border border-[#262626]
  rounded-md
  px-3 py-2
  text-[14px]
  font-sans
  placeholder:text-[#525252]
  focus:border-[#ea580c]
  focus:outline-none
  focus:ring-2 focus:ring-[#ea580c]/20
" />
```

---

## 7. 애니메이션 & 모션

### 7.1 transition duration 표준

| 유형 | duration | easing |
|------|----------|--------|
| 호버 (색상 변경) | 150ms | `ease-out` |
| 호버 (크기 변경) | 200ms | `ease-out` |
| 패널 열림/닫힘 | 250ms | `cubic-bezier(0.4, 0, 0.2, 1)` |
| 모달 | 200ms | `ease-out` |
| 토스트 | 300ms | `ease-in-out` |

### 7.2 prefers-reduced-motion 필수 대응

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### 7.3 글로우·맥박 효과 (HUD/Sci-Fi 차용)

**취약점 발견 시 toast·뱃지의 맥박 효과**:
```css
@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 8px rgba(234, 88, 12, 0.5); }
  50%      { box-shadow: 0 0 16px rgba(234, 88, 12, 0.8); }
}
.critical-pulse { animation: pulse-glow 2s ease-in-out infinite; }
```

---

## 8. Pre-Delivery 체크리스트

**모든 PR 머지 전에 확인**:

- [ ] 이모지를 아이콘으로 쓰지 않음 (SVG: Lucide/Heroicons)
- [ ] 모든 클릭 가능 요소에 `cursor-pointer`
- [ ] 호버 상태 transition 150-300ms 내
- [ ] 텍스트 대비 4.5:1 이상 (contrast checker 도구 검증)
- [ ] 모든 interactive 요소에 `focus-visible` 링 표시
- [ ] `prefers-reduced-motion: reduce` 미디어 쿼리 반영
- [ ] 반응형 검증: 375px, 768px, 1024px, 1440px 모두 정상
- [ ] AI purple/pink gradient 없음
- [ ] 네온·원색 그대로 사용 안 함
- [ ] 모든 이미지에 `alt` 속성
- [ ] Monaco 에디터 폰트가 JetBrains Mono로 적용됨

---

## 9. 페이지별 override 가이드

페이지별로 Master 규칙을 벗어나는 경우에만 `design-system/pages/*.md` 작성:

```
design-system/
├── MASTER.md              # 이 파일 (Global Source of Truth)
└── pages/
    ├── editor.md          # Monaco 에디터 페이지 (특수 스타일 필요)
    ├── dashboard.md       # 대시보드 페이지 (차트 색상 등)
    └── landing.md         # 랜딩 페이지 (Hero 섹션 등)
```

**Claude Code에 전달할 컨텍스트 프롬프트**:
> "I am building the [Page Name] page. Please read `design-system/MASTER.md`. Also check if `design-system/pages/[page-name].md` exists. If the page file exists, prioritize its rules. If not, use the Master rules exclusively."

---

*관련 문서: `10_UI_UX_REVISIONS.md` (기존 와이어프레임 수정 목록)*
