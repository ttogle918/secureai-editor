'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

/**
 * 랜딩 페이지 네비게이션 — 반응형 + 햄버거 메뉴
 * 모바일(< 768px): 햄버거 → 슬라이드 오버레이
 * 태블릿/데스크톱(≥ 768px): 일반 수평 레이아웃
 */
export default function LandingNav() {
  const [menuOpen, setMenuOpen] = useState(false);

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

  return (
    <nav className="landing-nav">
      <div className="landing-nav__inner">
        {/* Logo — 홈 링크 */}
        <Link href="/" className="landing-nav__logo" onClick={closeMenu}>
          <span style={{ color: '#ea580c' }}>⬡</span>{' '}
          <span style={{ color: '#e8e8ee' }}>Secure</span>
          <span style={{ color: '#ea580c' }}>AI</span>
        </Link>

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
          <Link href="/login" className="landing-nav__login">로그인</Link>
          <Link href="/register" className="landing-nav__cta">무료 시작</Link>
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

            <Link href="/login" className="landing-nav__mobile-link" onClick={closeMenu}>
              로그인
            </Link>
            <Link href="/register" className="landing-nav__mobile-cta" onClick={closeMenu}>
              무료 시작
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
