'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { apiClient } from '@/lib/api/client';

/**
 * 랜딩 페이지 네비게이션 — 반응형 + 햄버거 메뉴
 * 모바일(< 768px): 햄버거 → 슬라이드 오버레이
 * 태블릿/데스크톱(≥ 768px): 일반 수평 레이아웃
 * 로그인 상태: [대시보드 열기] + [로그아웃] 표시
 */
export default function LandingNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);  // localStorage 복원 완료 여부
  const storeLogout = useAuthStore((s) => s.logout);

  // 메뉴 오픈 시 body 스크롤 방지
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  const handleLogout = useCallback(async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch { /* ignore */ }
    storeLogout();
    closeMenu();
    // 이미 홈에 있으므로 그냥 새로고침으로 UI 리셋
    router.refresh();
  }, [storeLogout, router]);

  // ── 인증 버튼 렌더링 헬퍼 ─────────────────────────────────
  // hasHydrated 전(SSR/hydration)에는 기본 버튼으로 렌더링해 hydration mismatch 방지
  const AuthButtons = () =>
    (hasHydrated && user) ? (
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

  const MobileAuthButtons = () =>
    (hasHydrated && user) ? (
      <>
        <Link href="/editor" className="landing-nav__mobile-link" onClick={closeMenu}>
          대시보드 열기
        </Link>
        <button
          onClick={handleLogout}
          className="landing-nav__mobile-cta"
          style={{ cursor: 'pointer', border: 'none', textAlign: 'left', width: '100%', background: 'none' }}
        >
          로그아웃
        </button>
      </>
    ) : (
      <>
        <Link href="/login" className="landing-nav__mobile-link" onClick={closeMenu}>
          로그인
        </Link>
        <Link href="/register" className="landing-nav__mobile-cta" onClick={closeMenu}>
          무료 시작
        </Link>
      </>
    );

  return (
    <nav className="landing-nav">
      <div className="landing-nav__inner">
        {/* Logo — 홈 링크 */}
        <Link href="/" className="landing-nav__logo" onClick={closeMenu}>
          <span style={{ color: '#ea580c' }}>⬡</span>{' '}
          <span style={{ color: '#e8e8ee' }}>Secure</span>
          <span style={{ color: '#ea580c' }}>AI</span>
        </Link>

        {/* 로그인 상태 표시 배지 — 복원 완료 후에만 */}
        {hasHydrated && user && (
          <div style={{
            fontSize: 11, color: 'rgba(234,88,12,0.8)', fontWeight: 600,
            padding: '2px 8px', borderRadius: 10,
            background: 'rgba(234,88,12,0.08)', border: '1px solid rgba(234,88,12,0.2)',
            marginLeft: 8,
          }}>
            {user.displayName ?? user.username}
          </div>
        )}

        {/* Desktop nav links */}
        <div className="landing-nav__links">
          <a href="#features" className="landing-nav__link">기능</a>
          <a href="#pricing" className="landing-nav__link">가격</a>
          <Link href="/docs" className="landing-nav__link">문서</Link>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="landing-nav__link"
          >
            GitHub
          </a>
        </div>

        {/* Desktop auth buttons */}
        <div className="landing-nav__auth">
          <AuthButtons />
        </div>

        {/* Hamburger button (모바일 only) */}
        <button
          className="landing-nav__hamburger"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? '메뉴 닫기' : '메뉴 열기'}
          aria-expanded={menuOpen}
        >
          <span className={`landing-nav__bar ${menuOpen ? 'landing-nav__bar--open' : ''}`} />
          <span className={`landing-nav__bar ${menuOpen ? 'landing-nav__bar--open' : ''}`} />
          <span className={`landing-nav__bar ${menuOpen ? 'landing-nav__bar--open' : ''}`} />
        </button>
      </div>

      {/* Mobile overlay menu */}
      {menuOpen && (
        <div className="landing-nav__overlay" onClick={closeMenu}>
          <div
            className="landing-nav__mobile-menu"
            onClick={(e) => e.stopPropagation()}
          >
            <a href="#features" className="landing-nav__mobile-link" onClick={closeMenu}>
              기능
            </a>
            <a href="#pricing" className="landing-nav__mobile-link" onClick={closeMenu}>
              가격
            </a>
            <Link href="/docs" className="landing-nav__mobile-link" onClick={closeMenu}>
              문서
            </Link>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="landing-nav__mobile-link"
              onClick={closeMenu}
            >
              GitHub
            </a>

            <div className="landing-nav__mobile-divider" />

            <MobileAuthButtons />
          </div>
        </div>
      )}
    </nav>
  );
}
