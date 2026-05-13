# Tauri v2 데스크탑 앱 셋업 트러블슈팅 (2026-05-07)

> **환경**: Windows 11, Node.js 20, Git Bash (MINGW64)  
> **스택**: Next.js 15 + Tauri v2 (Rust)  
> **목표**: 기존 웹 프론트엔드를 Windows 설치파일(.exe)로 패키징

---

## 배경

SecureAI는 AI 기반 SAST/DAST 보안 분석 플랫폼이다.  
웹 브라우저에서 파일을 열 때 File System Access API의 제약이 있어, VS Code·Cursor처럼 네이티브 폴더 선택이 가능한 데스크탑 앱을 만들기로 했다.  
Electron 대신 **Tauri v2**를 선택한 이유: Chromium 내장 없이 Windows WebView2(Edge)를 사용하므로 번들 크기가 ~150MB → ~5MB로 크게 줄어든다.

---

## 문제 1 — `tauri icon` 실행 시 파일을 찾을 수 없음

### 증상

```
failed to read and decode source image ./app-icon.png:
지정된 파일을 찾을 수 없습니다. (os error 2)
```

### 원인

`tauri icon` 명령은 기본적으로 **현재 디렉토리(프론트엔드 루트)**의 `./app-icon.png`를 소스로 찾는다.  
아이콘 파일을 `src-tauri/icons/` 안에 넣으면 인식하지 못한다.

### 해결

방법 A — 파일을 루트에 두고 실행:
```bash
# apps/frontend/ 에 app-icon.png (1024×1024 PNG) 배치 후
npm run tauri:icon
```

방법 B — 경로를 직접 지정:
```bash
npm run tauri:icon -- src-tauri/icons/app-icon.png
```

### 결과

`src-tauri/icons/` 디렉토리에 모든 플랫폼용 아이콘이 자동 생성된다:

```
src-tauri/icons/
  32x32.png
  128x128.png
  128x128@2x.png
  icon.ico        ← Windows
  icon.icns       ← macOS
```

### 팁

소스 PNG는 **1024×1024 이상**을 권장한다. 작을수록 고해상도 아이콘이 흐려진다.  
빠른 플레이스홀더는 PowerShell로 생성 가능하다:

```powershell
Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap(1024, 1024)
$g   = [System.Drawing.Graphics]::FromImage($bmp)
$g.FillRectangle((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255,234,88,12))), 0, 0, 1024, 1024)
$font = New-Object System.Drawing.Font("Arial", 520, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$sf = New-Object System.Drawing.StringFormat
$sf.Alignment = [System.Drawing.StringAlignment]::Center
$sf.LineAlignment = [System.Drawing.StringAlignment]::Center
$g.DrawString("S", $font, [System.Drawing.Brushes]::White, (New-Object System.Drawing.RectangleF(0,0,1024,1024)), $sf)
$g.Dispose()
$bmp.Save("app-icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
```

---

## 문제 2 — `tauri dev` 실행 시 Cargo를 찾을 수 없음

### 증상

```
failed to run 'cargo metadata' command to get workspace directory:
failed to run command cargo metadata --no-deps --format-version 1: program not found
```

### 원인

Tauri는 Rust 런타임(Cargo)이 반드시 설치되어 있어야 한다.  
Electron은 Node.js만 있으면 동작하지만, Tauri는 Rust 컴파일러로 네이티브 바이너리를 빌드한다.

### 해결

**Step 1 — Rust 설치** (PowerShell 또는 CMD):

```powershell
winget install --id Rustlang.Rustup -e
```

또는 [rustup.rs](https://rustup.rs) → `rustup-init.exe` 다운로드 후 실행.  
설치 중 옵션 선택: **1번 (default)** 선택.

**Step 2 — 터미널 재시작** 후 확인:

```bash
cargo --version
# cargo 1.xx.x (xxxxxxx 2025-xx-xx)
rustc --version
# rustc 1.xx.x
```

**Step 3 — 개발 서버 실행**:

```bash
cd apps/frontend
npm run tauri:dev
```

### 주의사항

- **첫 빌드는 5~10분** 소요된다. Rust 의존성(`tauri`, `tauri-plugin-fs` 등)을 컴파일하기 때문이다. 이후 실행은 incremental 빌드로 빠르다.
- Git Bash(MINGW64)에서도 동작하지만, `cargo install` 같은 작업은 PowerShell이나 CMD가 더 안정적이다.
- Windows에서 Rust 빌드 시 MSVC 빌드 도구가 필요할 수 있다. `rustup` 설치 과정에서 자동으로 안내한다.

---

## 프로젝트 구조 정리

Tauri + Next.js 표준 구조:

```
apps/frontend/
  src/                  ← Next.js 소스 (웹과 공유)
  src-tauri/            ← Tauri Rust 프로젝트
    Cargo.toml
    build.rs
    tauri.conf.json
    capabilities/
      default.json      ← fs, dialog, shell 권한
    icons/              ← tauri icon 명령으로 자동 생성
    src/
      main.rs
      lib.rs
  app-icon.png          ← tauri icon 소스 (루트에 위치)
  package.json          ← tauri:dev, tauri:build 스크립트
  next.config.js        ← NEXT_OUTPUT=export 시 정적 빌드
```

---

## 웹 vs 데스크탑 빌드 분기

같은 Next.js 코드베이스에서 환경변수 하나로 두 가지 빌드를 생성한다:

| 빌드 대상 | 명령어 | Next.js output | 용도 |
|-----------|--------|----------------|------|
| 웹 (Docker) | `npm run build` | `standalone` | 서버 배포 |
| 데스크탑 (Tauri) | `npm run tauri:build` | `export` (정적) | Windows 설치파일 |

**`next.config.js` 핵심 설정**:

```js
const isDesktopBuild = process.env.NEXT_OUTPUT === 'export';
const nextConfig = {
  output: isDesktopBuild ? 'export' : 'standalone',
  images: isDesktopBuild ? { unoptimized: true } : {},
};
```

---

## 파일 시스템 접근 — 웹 vs 데스크탑 자동 분기

```typescript
// src/lib/tauri.ts
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}
```

`useWorkspace.ts`에서 환경을 감지해 자동 분기:

```typescript
if (isTauri()) {
  // Tauri: 네이티브 다이얼로그 → @tauri-apps/plugin-fs로 직접 읽기
  const dirPath = await pickDirectoryNative();
  files = await readDirectoryNative(dirPath);
} else {
  // 웹: File System Access API → 백엔드 Redis에 업로드
  const dirHandle = await window.showDirectoryPicker();
  // ...
}
```

---

## 최종 결과

| 항목 | 상태 |
|------|------|
| `npm run tauri:icon` | ✅ 성공 (경로 직접 지정) |
| Rust/Cargo 설치 | ✅ 성공 |
| `npm run tauri:dev` | ✅ 성공 |
| 네이티브 폴더 선택 | ✅ `@tauri-apps/plugin-dialog` |
| Windows NSIS 설치파일 빌드 | `npm run tauri:build`로 생성 가능 |

---

## 참고

- [Tauri v2 공식 문서](https://tauri.app)
- [Tauri + Next.js 가이드](https://tauri.app/start/frontend/nextjs/)
- [rustup.rs](https://rustup.rs) — Rust 설치
