# SecureAI — UI/UX 수정사항 목록
> 기준: UI UX Pro Max v2.0 Pre-delivery 체크리스트  
> 대상: 기존 와이어프레임 3종(`secureai-wireframe.html`, `secureai-webapp.html`, `secureai-mobile.html`) 및 향후 React 구현  
> 작성일: 2026-04-19

---

## 우선순위 분류

- 🔴 **Critical**: 반드시 수정 (접근성·신뢰성 직결)
- 🟠 **High**: 강하게 권장 (UX 일관성)
- 🟡 **Medium**: 개선 권장 (다듬기)

---

## 1. 이모지 아이콘 전체 교체 🔴

**문제**: 기존 와이어프레임 전반에 이모지(🛡️ 🔴 🟠 🟡 📁 🔍 💬 등)가 아이콘으로 사용됨.  
**이유**: UI UX Pro Max Anti-pattern 1순위. 플랫폼·브라우저·폰트마다 렌더링 상이. 접근성 스크린리더 읽기 불량. 프로페셔널함 훼손.

### 교체 매핑 표

| 현재 이모지 | 교체 컴포넌트 (lucide-react) | 용도 |
|------------|---------------------------|------|
| 🛡️ SecureAI | `<Shield />` | 로고 옆 아이콘 |
| 🔴 Critical | `<SeverityDot level="critical" />` (커스텀) | 심각도 표시 |
| 🟠 High | `<SeverityDot level="high" />` | 심각도 표시 |
| 🟡 Medium | `<SeverityDot level="medium" />` | 심각도 표시 |
| 🟢 Low | `<SeverityDot level="low" />` | 심각도 표시 |
| 📁 폴더 | `<Folder />` / `<FolderOpen />` | 파일 트리 |
| 📄 파일 | `<File />` / `<FileCode />` | 파일 트리 |
| 🔍 검색 | `<Search />` | 검색 입력 |
| 💬 채팅 | `<MessageSquare />` | AI 채팅 |
| ⚙️ 설정 | `<Settings />` | 설정 메뉴 |
| 📊 대시보드 | `<LayoutDashboard />` | 대시보드 뷰 |
| 📝 에디터 | `<Code2 />` | 에디터 뷰 |
| ⚠️ 경고 | `<AlertTriangle />` | 경고 메시지 |
| ✅ 성공 | `<CheckCircle2 />` | 완료 상태 |
| ❌ 실패 | `<XCircle />` | 실패 상태 |
| 🔒 잠금 | `<Lock />` / `<Unlock />` | 권한 표시 |
| 📥 다운로드 | `<Download />` | 리포트 다운로드 |
| 🚀 시작 | `<Play />` / `<Zap />` | 분석 시작 버튼 |
| ⏸️ 중단 | `<Pause />` | 분석 중단 |
| 🔄 재개 | `<RotateCw />` / `<RefreshCw />` | 분석 재개 |
| 📋 복사 | `<Copy />` | 코드 복사 |
| 🐙 GitHub | `<Github />` | GitHub 연동 |

### 심각도 dot 컴포넌트 예시

```tsx
// components/ui/SeverityDot.tsx
type Level = 'critical' | 'high' | 'medium' | 'low' | 'info';

const colors: Record<Level, { bg: string; glow: string }> = {
  critical: { bg: 'bg-red-600',    glow: 'shadow-[0_0_6px_rgba(220,38,38,0.8)]' },
  high:     { bg: 'bg-orange-600', glow: 'shadow-[0_0_6px_rgba(234,88,12,0.8)]' },
  medium:   { bg: 'bg-yellow-500', glow: 'shadow-[0_0_6px_rgba(234,179,8,0.7)]' },
  low:      { bg: 'bg-green-600',  glow: 'shadow-[0_0_6px_rgba(22,163,74,0.6)]' },
  info:     { bg: 'bg-blue-500',   glow: 'shadow-[0_0_6px_rgba(59,130,246,0.6)]' },
};

export function SeverityDot({ level }: { level: Level }) {
  return (
    <span 
      className={`inline-block w-2 h-2 rounded-full ${colors[level].bg} ${colors[level].glow}`}
      aria-label={`${level} severity`}
    />
  );
}
```

---

## 2. 반응형 breakpoint 4개 대응 🔴

**문제**: 현재 HTML은 데스크톱·모바일 뷰만 있고 태블릿·와이드 검증 안 됨.  
**이유**: UI UX Pro Max는 **375/768/1024/1440 4개 breakpoint 필수** 명시.

### 수정 액션

- [ ] `tailwind.config.js`에 screens 4단계 명시 (`09_DESIGN_SYSTEM.md` 섹션 5 참고)
- [ ] 각 페이지 Chrome DevTools 기기 툴바로 4개 크기 검증
- [ ] 태블릿(768px) 전용 레이아웃: 사이드바 drawer 형태
- [ ] 와이드(1440px+) 전용: 에디터 max-width 제한 고려

---

## 3. cursor-pointer 명시 🔴

**문제**: `<div onClick>` 방식으로 클릭 가능한 요소에 커서 피드백 없음.  
**이유**: UI UX Pro Max 체크리스트 필수 항목.

### 수정 액션

```tsx
// ❌ 현재
<div onClick={handleClick}>Click me</div>

// ✅ 수정
<button 
  onClick={handleClick}
  className="cursor-pointer"
>
  Click me
</button>
```

**권장**: 가능한 모든 경우 `<button>` 태그 사용. `<div>`에 `onClick`을 붙여야 한다면 반드시 `role="button"`, `tabIndex={0}`, `onKeyDown` 추가.

---

## 4. 포커스 상태 (키보드 네비게이션) 🔴

**문제**: 현재 와이어프레임에 `:focus-visible` 스타일 없음.  
**이유**: 접근성 AA 수준 필수 + UI UX Pro Max 체크리스트.

### 수정 액션

`globals.css`에 추가:
```css
/* 전역 포커스 스타일 */
*:focus-visible {
  outline: 2px solid #ea580c;
  outline-offset: 2px;
  border-radius: 4px;
}

/* 마우스 클릭 시에는 포커스링 숨김 */
*:focus:not(:focus-visible) {
  outline: none;
}
```

**키보드로 전체 네비 가능한지 검증 필수** — Tab 키만으로 모든 기능 사용 가능해야 함.

---

## 5. prefers-reduced-motion 대응 🔴

**문제**: 현재 모든 애니메이션이 reduced motion 사용자에게도 그대로 재생됨.  
**이유**: WCAG 2.1 AA + UI UX Pro Max 필수.

### 수정 액션

`globals.css` 최상단에 추가:
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

Framer Motion 사용 시:
```tsx
import { useReducedMotion } from 'framer-motion';

const shouldReduceMotion = useReducedMotion();
<motion.div 
  animate={{ x: shouldReduceMotion ? 0 : 100 }}
  transition={{ duration: shouldReduceMotion ? 0 : 0.3 }}
/>
```

---

## 6. 텍스트 대비 4.5:1 검증 🟠

**문제**: 일부 `text-tertiary` (#737373)가 작은 텍스트에 사용됨 — 대비 검증 필요.  
**이유**: WCAG AA 기준 + UI UX Pro Max 필수.

### 수정 액션

1. Chrome DevTools → Accessibility → Color contrast 검사
2. 또는 https://webaim.org/resources/contrastchecker/ 로 검증
3. **본문(14px 이하)은 반드시 4.5:1 이상**, 큰 텍스트(18px+)는 3:1 이상 허용

**현재 검증된 조합** (`09_DESIGN_SYSTEM.md` 섹션 2.4 참고):
- `--text-primary` (#fafafa) on `--bg-1` (#0f0f0f): 18.5:1 ✅
- `--text-secondary` (#a3a3a3) on `--bg-1`: 7.2:1 ✅
- `--text-tertiary` (#737373) on `--bg-1`: 4.8:1 ✅ (경계선 — 16px 이상 권장)
- `--text-disabled` (#525252) on `--bg-1`: 3.1:1 ⚠️ (비활성 + 큰 텍스트만)

---

## 7. alt 속성 & ARIA 레이블 🟠

**문제**: 와이어프레임 SVG·아이콘에 `alt` 또는 `aria-label` 일부 누락.  
**이유**: 스크린리더 호환.

### 수정 액션

```tsx
// 장식용 아이콘 (의미 없음)
<Shield aria-hidden="true" />

// 기능 아이콘 (의미 있음)
<button aria-label="분석 시작">
  <Play aria-hidden="true" />
</button>

// 상태 표시
<SeverityDot level="critical" aria-label="Critical severity" />

// 이미지
<img src="..." alt="보안 점수 차트" />
```

---

## 8. Monaco 에디터 폰트 🟠

**문제**: Monaco 기본 폰트는 Consolas/Menlo. SecureAI 디자인 시스템의 JetBrains Mono와 불일치.  
**이유**: 일관된 코드 표현 + 합자(ligature) 활용.

### 수정 액션

```tsx
// CodeEditor.tsx
<Editor
  theme="secureai-dark"
  options={{
    fontFamily: "'JetBrains Mono', 'Consolas', monospace",
    fontLigatures: true,
    fontSize: 13,
    lineHeight: 22,
    // ... 기타 옵션
  }}
/>
```

`globals.css`에서 JetBrains Mono 웹폰트 preload:
```html
<link rel="preload" href="/fonts/JetBrainsMono-Regular.woff2" as="font" type="font/woff2" crossorigin />
```

---

## 9. 로딩·에러 상태 표준화 🟠

**문제**: 현재 와이어프레임에 Skeleton / Empty / Error 상태 표준 없음.  
**이유**: UX 일관성 + 체감 성능 향상.

### 수정 액션

**3가지 상태 필수 구현**:

```tsx
// Skeleton (로딩 중)
<div className="animate-pulse bg-[#1a1a1a] rounded h-20 w-full" />

// Empty (데이터 없음)
<EmptyState 
  icon={<Inbox />}
  title="아직 분석한 프로젝트가 없습니다"
  description="새 프로젝트를 생성해서 보안 분석을 시작해보세요"
  action={<Button onClick={...}>새 프로젝트</Button>}
/>

// Error
<ErrorState
  icon={<AlertTriangle className="text-red-500" />}
  title="분석 실패"
  description={errorMessage}
  action={<Button onClick={retry}>다시 시도</Button>}
/>
```

---

## 10. 툴팁·도움말 일관성 🟡

**문제**: 툴팁 스타일이 Monaco 기본·Toast·커스텀 등 혼재.  
**이유**: 일관된 UX.

### 수정 액션

단일 Tooltip 컴포넌트 사용 (Radix UI 또는 shadcn/ui):
```tsx
<Tooltip>
  <TooltipTrigger asChild>
    <button>?</button>
  </TooltipTrigger>
  <TooltipContent className="bg-[#1a1a1a] border-[#262626] text-[12px] px-2 py-1">
    도움말 텍스트
  </TooltipContent>
</Tooltip>
```

---

## 11. Scrollbar 커스터마이징 🟡

**문제**: 기본 브라우저 스크롤바가 밝은 회색 — 다크 테마와 시각적 충돌.  
**이유**: Dark Mode OLED 일관성.

### 수정 액션

`globals.css`:
```css
/* Webkit (Chrome, Safari, Edge) */
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: #0f0f0f; }
::-webkit-scrollbar-thumb {
  background: #404040;
  border-radius: 4px;
  border: 2px solid #0f0f0f;
}
::-webkit-scrollbar-thumb:hover { background: #525252; }

/* Firefox */
* {
  scrollbar-width: thin;
  scrollbar-color: #404040 #0f0f0f;
}
```

---

## 12. 진행 체크리스트 UI (신규) 🟠

**TASK-406 신규 구현** — `08_CHECKPOINT_FLOW.md` 참고.

체크리스트 UI 스타일 가이드:

```tsx
// components/analysis/ProgressChecklist.tsx
<div className="bg-[#141414] border border-[#262626] rounded-lg p-4">
  <h3 className="text-base font-semibold text-[#fafafa] mb-3">
    <ClipboardCheck className="inline mr-2" size={18} />
    분석 진행 상황
  </h3>
  
  {/* 체크리스트 아이템 */}
  <div className="space-y-2">
    {steps.map(step => (
      <div key={step.id} className="flex items-center gap-2 text-sm">
        {step.done 
          ? <CheckSquare className="text-green-500" size={16} />
          : <Square className="text-[#525252]" size={16} />
        }
        <span className={step.done ? 'text-[#a3a3a3] line-through' : 'text-[#fafafa]'}>
          {step.label}
        </span>
        {step.inProgress && (
          <Loader2 className="animate-spin text-[#ea580c] ml-auto" size={14} />
        )}
      </div>
    ))}
  </div>

  {/* 중단 시 재개 버튼 */}
  {isInterrupted && (
    <button 
      onClick={handleResume}
      className="mt-4 w-full bg-[#ea580c] hover:bg-[#f97316] text-white py-2 rounded-md cursor-pointer transition-colors"
    >
      <RotateCw className="inline mr-2" size={16} />
      분석 재개하기
    </button>
  )}
</div>
```

---

## 수정 작업 순서 (Sprint에 포함)

| 단계 | 작업 | 해당 스프린트 |
|------|------|-------------|
| 1 | `tailwind.config.js` 4 breakpoint 설정 | Sprint 0 (TASK-006) |
| 2 | `globals.css` 전역 포커스·reduced-motion·scrollbar | Sprint 0 (TASK-006) |
| 3 | Design System MASTER.md 프로젝트 docs/에 배치 | Sprint 0 (TASK-001) |
| 4 | lucide-react 설치 + 아이콘 교체 | Sprint 4 (TASK-401) |
| 5 | `SeverityDot` 등 공통 컴포넌트 | Sprint 4 (TASK-404) |
| 6 | Monaco JetBrains Mono 적용 | Sprint 4 (TASK-401) |
| 7 | Skeleton/Empty/Error 표준 컴포넌트 | Sprint 4 (TASK-404) |
| 8 | 체크리스트 UI 구현 | Sprint 4 (TASK-406) |
| 9 | 전체 대비·키보드 네비 검증 | Sprint 8 (TASK-804) |

---

*관련 문서: `09_DESIGN_SYSTEM.md` (색상·타이포·간격 전체 정의)*
