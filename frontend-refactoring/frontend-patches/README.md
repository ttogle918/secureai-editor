# Pagori — Frontend Patches (Round 1: Editor)

이 디렉토리는 메인 에디터에 V4 Hybrid 디자인을 적용하기 위한 **첫 라운드** 패치입니다.
원본 파일 구조를 그대로 미러링했으니, 같은 경로의 파일을 그대로 덮어쓰면 됩니다.

## 이 라운드에 포함된 변경 (보수적 · 비파괴적)

| 영역 | 파일 | 변경 |
|---|---|---|
| 🎨 토큰 | `src/app/globals.css` | 다크 글자색 밝게 (`--text-primary` `#f1f1f6` 등), `--text-active` 신규 토큰, `--text-on-bg`, `.chip` / `.chip-*` 유틸 클래스 추가 |
| 🎨 브랜드 | `public/pagori-mark.png` | Pagori 마크 (헤더용) |
| 🎨 브랜드 | `src/components/brand/PagoriBrand.tsx` | `<PagoriMark>` · `<PagoriLockup>` 컴포넌트 |
| ⚛️ 헤더 | `src/components/layout/AppHeader.tsx` | Pagori 브랜딩 · 세그먼티드 Editor/Dashboard · CMD+K 검색 버튼 · 알림 벨 · 새 chip 스타일 |

## 적용 방법

```bash
# 프로젝트 루트(= frontend/)에서
cp -r path/to/this/frontend-patches/* ./
```

`AppHeader.tsx`는 `apiGroupFilter` / `setApiGroupFilter`를 `useSecureStore`에서 읽고 씁니다 — 이미 존재하는 상태라면 그대로 작동합니다. 없다면 store에 추가가 필요합니다 (다음 라운드에서 안내).

## 의존성 추가 필요

`AppHeader.tsx`에서 `lucide-react`의 `Bell`, `Search` 아이콘을 추가로 import합니다. 이미 `lucide-react`가 설치되어 있으니 별도 패키지 설치는 불필요.

## 다음 라운드 (예고)

1. **EditorLayout.tsx 재구조** — V4 Hybrid 3-panel + 접히는 슬림 사이드바
2. **RightPanel.tsx 개편** — 탭(취약점/채팅/진행률) → 활동 패널(심각도+DAST+API 3줄 필터 + 그룹 아코디언 + 다중선택 액션바)
3. **FloatingChat.tsx 신규** — 오른쪽 아래 플로팅 채팅 버블 (closed/popup/docked 상태)
4. **컨텍스트 메뉴 + @ 멘션** — 취약점에서 AI 호출
