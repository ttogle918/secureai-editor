import Link from 'next/link';
import { LegalFooter } from './LegalFooter';

/** 법적 페이지 공통 셸 — 다크 테마, 가독성 위주 레이아웃 + Footer. */
export function LegalPageShell({ title, updated, children }: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-1, #0d0d0f)', color: 'var(--text-primary, #f1f1f6)' }}>
      <div style={{ borderBottom: '1px solid var(--hairline, rgba(255,255,255,0.07))', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link href="/" style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', textDecoration: 'none' }}>
          Secure<span style={{ color: 'var(--orange, #f97316)' }}>AI</span>
        </Link>
      </div>
      <article style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px' }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 8 }}>{title}</h1>
        <p style={{ fontSize: 13, color: 'var(--text-tertiary, #74747e)', marginBottom: 8 }}>최종 업데이트: {updated}</p>
        <p style={{ fontSize: 12, color: 'var(--text-tertiary, #74747e)', marginBottom: 32, fontStyle: 'italic' }}>
          🌐 English version coming soon. / ⚖️ 본 문서는 법무 검토 후 정식 발효됩니다.
        </p>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--text-secondary, #b4b4be)' }}>
          {children}
        </div>
        <LegalFooter />
      </article>
    </div>
  );
}

export const legalH2: React.CSSProperties = {
  fontSize: 17, fontWeight: 700, color: 'var(--text-primary, #f1f1f6)', margin: '28px 0 10px',
};
