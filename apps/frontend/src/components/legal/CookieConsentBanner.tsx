'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const CONSENT_KEY = 'secureai-cookie-consent'; // 'all' | 'essential'

/**
 * GDPR/PIPA 쿠키 동의 배너.
 * 첫 방문(동의 기록 없음) 시 표시. "필수만 허용" / "전체 허용" 2-선택지 — 단일 거절 옵션 금지(GDPR).
 * 비필수(분석/마케팅) 쿠키는 'all' 동의가 있을 때만 설정해야 한다.
 */
export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!localStorage.getItem(CONSENT_KEY)) setVisible(true);
  }, []);

  const choose = (value: 'all' | 'essential') => {
    localStorage.setItem(CONSENT_KEY, value);
    setVisible(false);
    // 비필수 쿠키 초기화는 value === 'all' 일 때만 (분석 도구 연동 시 여기서 처리)
  };

  if (!visible) return null;

  return (
    <div role="dialog" aria-label="쿠키 동의" style={{
      position: 'fixed', left: 16, right: 16, bottom: 16, zIndex: 1000,
      maxWidth: 720, margin: '0 auto', padding: '16px 20px',
      borderRadius: 12, background: 'var(--bg-3, #161619)', border: '1px solid var(--border-2, #2a2a30)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12,
    }}>
      <p style={{ flex: 1, minWidth: 240, fontSize: 13, color: 'var(--text-secondary, #b4b4be)', lineHeight: 1.5, margin: 0 }}>
        Kkebi는 서비스 제공에 필요한 필수 쿠키와, 동의 시 분석용 쿠키를 사용합니다.{' '}
        <Link href="/legal/cookie" style={{ color: 'var(--orange, #f97316)', textDecoration: 'underline' }}>쿠키 정책</Link>
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => choose('essential')} style={btn('ghost')}>필수만 허용</button>
        <button onClick={() => choose('all')} style={btn('solid')}>전체 허용</button>
      </div>
    </div>
  );
}

function btn(kind: 'solid' | 'ghost'): React.CSSProperties {
  return {
    padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
    border: kind === 'solid' ? 'none' : '1px solid var(--border-2, #2a2a30)',
    background: kind === 'solid' ? 'var(--orange-2, #ea580c)' : 'transparent',
    color: kind === 'solid' ? '#fff' : 'var(--text-secondary, #b4b4be)',
  };
}
