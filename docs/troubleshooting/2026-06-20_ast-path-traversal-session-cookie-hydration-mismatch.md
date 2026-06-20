# AST 경로 순회 우회 · 로컬 세션 쿠키 유실 · Hydration 불일치 트러블슈팅 기록

**날짜**: 2026-06-20  
**브랜치**: `main`  
**관련 커밋**: (구현 및 커밋 예정)

---

## 이슈 1 — AST Hallucination Guard 경로 순회(Path Traversal) 검증 우회

### 증상

- 결정론적 AST 검증(VAL-3) 도중 파일 경로 순회 위협(`..`, `~` 등 포함)이 포함된 `finding`이 탐지되어 경고 로그(`path traversal attempt blocked`)가 정상적으로 남음.
- 그러나 해당 취약점이 버려지지 않고 오히려 검증 성공(`verified=True`) 처리되어 백엔드 DB에 그대로 저장되는 취약점이 존재함.

### 원인 분석

- `apps/ai_engine/agent/validation/ast_verifier.py` 내 `verify_finding()` 함수에서 경로 순회 위협을 식별한 경우 `verified: False`를 반환해야 하나, 오타/논리적 실수로 `{"verified": True, ...}`를 반환함.

### 해결

`apps/ai_engine/agent/validation/ast_verifier.py`의 리턴값을 `False`로 정정하여 유해 파일 탐색 시도를 완전 차단 및 폐기하도록 수정:

```python
# apps/ai_engine/agent/validation/ast_verifier.py

    # file 경로 순회 방어
    file_path: str = finding.get("file", "")
    if file_path and not _is_safe_path(file_path):
        logger.warning("[ast_verifier] path traversal attempt blocked: %s", file_path)
        return {"verified": False, "reason": "path traversal blocked"}  # True -> False
```

---

## 이슈 2 — HTTP 환경(로컬 개발)에서 Secure Cookie 설정으로 인한 세션 끊김

### 증상

- 로컬 개발 환경(`http://localhost:3000`)에서 로그인 완료 직후 홈(`/`) 화면으로 이동하거나 페이지를 새로고침하면 로그인 세션이 즉시 풀리며 네비바가 '로그인' 상태로 되돌아감.

### 원인 분석

- `apps/backend/src/main/java/io/secureai/backend/domain/auth/service/AuthService.java` 내 `setRefreshCookie` 및 `clearRefreshCookie`에서 `cookie.setSecure(true)`가 하드코딩되어 있음.
- `Secure=true` 쿠키는 오직 HTTPS 연결을 통해서만 전송되므로, HTTP 프로토콜을 사용하는 로컬 개발 환경에서는 브라우저가 쿠키 저장을 거부하거나 `/auth/refresh` 호출 시 쿠키를 전송하지 않아 401 Unauthorized 오류가 유발되고 최종적으로 `storeLogout()`이 실행되어 로컬스토리지의 사용자 정보가 지워짐.

### 해결

`HttpServletRequest`를 받아 요청 프로토콜 사양(`request.isSecure()`)에 따라 동적으로 `Secure` 속성을 주입하도록 수정:

```java
// apps/backend/src/main/java/io/secureai/backend/domain/auth/service/AuthService.java

    private void setRefreshCookie(String token, HttpServletRequest request, HttpServletResponse response) {
        Cookie cookie = new Cookie(REFRESH_COOKIE, token);
        cookie.setHttpOnly(true);
        cookie.setSecure(request.isSecure()); // 동적 설정
        cookie.setPath("/api/v1/auth");
        cookie.setMaxAge((int) jwtProperties.getRefreshTokenExpirySeconds());
        cookie.setAttribute("SameSite", "Strict");
        response.addCookie(cookie);
    }

    private void clearRefreshCookie(HttpServletRequest request, HttpServletResponse response) {
        Cookie cookie = new Cookie(REFRESH_COOKIE, "");
        cookie.setHttpOnly(true);
        cookie.setSecure(request.isSecure()); // 동적 설정
        cookie.setPath("/api/v1/auth");
        cookie.setMaxAge(0);
        response.addCookie(cookie);
    }
```

---

## 이슈 3 — Next.js Hydration Mismatch로 인한 LandingNav 오작동 및 로그인 고착

### 증상

- 실제 로그인되어 상태 저장소(user)에 유저 정보가 있음에도 불구하고, 홈(`/`) 화면 진입 시 네비바에 '대시보드 열기' 및 '로그아웃' 버튼 대신 '로그인' 버튼으로 고착되며 햄버거 메뉴 등이 정상 동작하지 않음.
- 브라우저 콘솔에 Hydration Mismatch 에러 발생.

### 원인 분석

- `LandingNav.tsx`에서 Zustand 스토어의 `_hasHydrated`와 `user` 상태에 따라 서버/클라이언트 렌더링 분기를 태움.
- 서버 측에서는 LocalStorage가 존재하지 않으므로 무조건 비로그인 마크업을 렌더링하여 클라이언트에 전송하지만, 클라이언트는 수화(Hydration) 시점에 `user`가 있는 로그인 마크업을 렌더링하게 됨으로써 HTML 불일치(Mismatch)가 발생하고 React 바인딩이 실패함.
- 또한 React 컴포넌트 내부에서 또 다른 컴포넌트를 동적으로 선언하는 안티패턴(`const AuthButtons = () => ...`)을 포함함.

### 해결

- 컴포넌트 내에 `isMounted` 상태를 도입하여 클라이언트 마운트 완료 전에는 항상 서버 렌더링용 초기 마크업(로그아웃 상태용 버튼)을 동일하게 반환함.
- 마운트가 완료된 후(`useEffect`)에 `user` 상태에 따라 로그인/로그아웃 마크업이 교체되도록 제어하며, 내장 컴포넌트 선언 대신 JSX 내 인라인 조건부 렌더링 또는 함수 호출 형식으로 리팩토링함.

```typescript
// apps/frontend/src/components/landing/LandingNav.tsx

export default function LandingNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false); // 마운트 완료 여부 추적
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const storeLogout = useAuthStore((s) => s.logout);

  useEffect(() => {
    setIsMounted(true); // 마운트 완료 표시
  }, []);

  ...
  
  // 마운트 전에는 서버와 동일한 마크업을 렌더링하여 Hydration Mismatch를 완전히 방지
  const renderAuthButtons = () => {
    if (!isMounted) {
      return (
        <>
          <Link href="/login" className="landing-nav__login">로그인</Link>
          <Link href="/register" className="landing-nav__cta">무료 시작</Link>
        </>
      );
    }

    return user ? (
      <>
        <Link href="/editor" className="landing-nav__login" onClick={closeMenu}>
          대시보드 열기
        </Link>
        <button
          onClick={handleLogout}
          className="landing-nav__cta"
          style={{ cursor: 'pointer', border: 'none' }}
        >
          로그아웃
        </button>
      </>
    ) : (
      <>
        <Link href="/login" className="landing-nav__login">로그인</Link>
        <Link href="/register" className="landing-nav__cta">무료 시작</Link>
      </>
    );
  };
}
```
