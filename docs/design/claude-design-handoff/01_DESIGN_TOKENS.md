# 디자인 토큰 (발췌 — `apps/frontend/src/app/globals.css`)

> 테마: **Dark OLED + Orange(#f97316) 액센트**. 아래 토큰을 그대로 사용/매핑하라.

## 배경 (어두운 → 밝은 레이어)
```
--bg-0 #080809  --bg-1 #0d0d0f  --bg-2 #111114  --bg-3 #161619  --bg-4 #1c1c20
--surface-overlay rgba(255,255,255,.02)   --surface-hover rgba(255,255,255,.04)
```
## 보더
```
--border #1f1f24  --border-2 #2a2a30  --border-3 #3a3a44  --hairline rgba(255,255,255,.06)
```
## 텍스트
```
--text-primary #f1f1f6  --text-secondary #b4b4be  --text-tertiary #74747e
--text-disabled #54545e  --text-active #ffffff  --text-on-bg #e6e6ec
```
## 액센트 (Orange — locked)
```
--orange #f97316  --orange-2 #ea580c  --orange-dim rgba(249,115,22,.12)
--orange-glow rgba(249,115,22,.25)  --orange-shadow 0 3px 12px rgba(234,88,12,.30)
```
## 심각도 (Severity) — badge 색
```
critical #f04141   high #f59e0b   medium #eab308   low #22c55e   info #569cd6
(각 *-dim 10% 배경 변형 존재. 레거시 alias: --red/--yellow/--amber/--green/--blue)
```
## 필터 태그 팔레트 (카테고리 구분 색)
```
--tag-1 #818cf8(indigo) --tag-2 #f472b6(pink) --tag-3 #34d399(emerald)
--tag-4 #fbbf24(amber)  --tag-5 #60a5fa(blue)  --tag-6 #a78bfa(violet)
```

## 디자인 의미 매핑 (신규 컴포넌트에 적용)
- **proven 성공(DAST 증명됨)**: `--critical` 계열(붉은 "딱지") — "정말 뚫림"을 강조.
- **VERIFIED 패치**: `--low`(green) / **FAILED**: `--critical`(red) / **PENDING**: `--text-tertiary`.
- **선택 상태(벌크 다중선택)**: `--orange-dim` 배경 + `--orange` 보더.
- **벌크 액션바**: `--bg-3` 바 + `--orange` 주요 버튼(`--orange-shadow`).
