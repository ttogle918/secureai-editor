import Link from 'next/link';

/** 법적 페이지 3종 링크 푸터. 회원가입·법적 페이지 하단에 마운트. */
export function LegalFooter() {
  return (
    <footer style={{
      marginTop: 32, padding: '20px 0', textAlign: 'center',
      fontSize: 12, color: 'var(--text-tertiary, #74747e)',
      display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap',
    }}>
      <Link href="/legal/terms" style={linkStyle}>이용약관</Link>
      <span aria-hidden>·</span>
      <Link href="/legal/privacy" style={linkStyle}>개인정보처리방침</Link>
      <span aria-hidden>·</span>
      <Link href="/legal/cookie" style={linkStyle}>쿠키 정책</Link>
      <span aria-hidden>·</span>
      <span>© {new Date().getFullYear()} SecureAI</span>
    </footer>
  );
}

const linkStyle: React.CSSProperties = { color: 'var(--text-tertiary, #74747e)', textDecoration: 'none' };
