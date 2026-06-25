// app/layout.tsx
// 루트 레이아웃 — 폰트 최적화 + Provider 트리
import type { Metadata } from 'next';
import { JetBrains_Mono, Space_Grotesk } from 'next/font/google';
import AuthProvider from '@/components/AuthProvider';
import { CookieConsentBanner } from '@/components/legal/CookieConsentBanner';
import './globals.css';

// ── Fonts (UI/UX REVISIONS.md §8 대응) ──────────────────
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
  variable: '--font-mono',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

// ── SEO Metadata ─────────────────────────────────────────
export const metadata: Metadata = {
  title: 'Kkebi — AI 보안 감사 에이전트',
  description:
    'AI 기반 차세대 보안 감사 플랫폼 · SAST/DAST 3-Layer 자동 분석 · MCP + Claude AI',
  keywords: ['보안', 'SAST', 'DAST', 'AI', 'Kkebi', '취약점', 'DevSecOps'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ko"
      className={`${jetbrainsMono.variable} ${spaceGrotesk.variable}`}
    >
      <body style={{ margin: 0 }}>
        <AuthProvider>{children}</AuthProvider>
        <CookieConsentBanner />
      </body>
    </html>
  );
}
