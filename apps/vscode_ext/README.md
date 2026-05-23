# SecureAI VSCode Extension

AI 기반 보안 취약점 스캐너 VSCode Extension (MVP).

## 로컬 설치

1. 빌드: `npm install && npm run package`
2. 설치: `code --install-extension secureai-0.1.0.vsix`
3. 또는 VSCode에서 `Extensions > ... > Install from VSIX...`

## 사용법

1. `Ctrl+Shift+P` → `SecureAI: Set API Token` → JWT 토큰 입력
2. `Ctrl+Shift+P` → `SecureAI: Analyze Current Workspace`
3. Problems 탭에서 취약점 확인

## 환경변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `SECUREAI_API_URL` | `http://localhost:8080/api/v1` | Backend API 기본 URL |

## 개발 빌드

```bash
npm install
npm run compile    # TypeScript 컴파일 (out/ 생성)
npm run package    # .vsix 패키지 생성
```
