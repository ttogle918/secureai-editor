import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SecureAI — AI 보안 감사 에이전트',
  description: 'AI 기반 차세대 보안 감사 및 화이트해킹 에이전트',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
