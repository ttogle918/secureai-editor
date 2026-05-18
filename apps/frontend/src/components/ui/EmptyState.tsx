// components/ui/EmptyState.tsx
// 빈 상태 컴포넌트 — EmptyStates.jsx 디자인 시안 반영
// eyebrow(카테고리 레이블) + SVG 일러스트 + title + body + actions 구조
import type { ReactNode } from 'react';

interface EmptyStateProps {
  /** SVG 일러스트 또는 아이콘 노드 */
  icon?: ReactNode;
  /** 소문자 카테고리 레이블 (예: "첫 진입", "스캔 전") */
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  /** 카드 최대 너비 (기본값: 320) */
  maxWidth?: number;
}

export function EmptyState({ icon, eyebrow, title, description, action, maxWidth = 320 }: EmptyStateProps) {
  return (
    <div
      role="status"
      style={{
        width: '100%',
        maxWidth,
        background: 'var(--bg-1)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 28,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: 14,
        margin: '0 auto',
      }}
    >
      {icon && (
        <span aria-hidden="true">
          {icon}
        </span>
      )}
      {eyebrow && (
        <div
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: 'var(--text-tertiary)',
            letterSpacing: '0.10em',
            fontFamily: 'var(--font-mono)',
            textTransform: 'uppercase',
          }}
        >
          {eyebrow}
        </div>
      )}
      <p style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
        {title}
      </p>
      {description && (
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55, maxWidth: 240 }}>
          {description}
        </p>
      )}
      {action && (
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          {action}
        </div>
      )}
    </div>
  );
}

// ── 인라인 일러스트 모음 ────────────────────────────────────────
// 각 화면의 빈 상태에 맞는 SVG 일러스트를 제공한다.

/** 첫 프로젝트 진입 */
export function FirstProjectIllo() {
  return (
    <svg width="88" height="80" viewBox="0 0 88 80" fill="none">
      <rect x="10" y="22" width="58" height="48" rx="8" fill="var(--bg-3)" stroke="var(--border-2)" strokeWidth="1" />
      <rect x="18" y="14" width="58" height="48" rx="8" fill="var(--bg-2)" stroke="var(--border-2)" strokeWidth="1" />
      <rect x="26" y="6" width="58" height="48" rx="8" fill="var(--orange-dim)" stroke="var(--orange)" strokeWidth="1.5" />
      <path d="M55 30 L55 38 M51 34 L59 34" stroke="var(--orange)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** 스캔 준비 완료 */
export function ScanReadyIllo() {
  return (
    <svg width="88" height="80" viewBox="0 0 88 80" fill="none">
      <rect x="14" y="18" width="60" height="44" rx="6" fill="var(--bg-3)" stroke="var(--border-2)" strokeWidth="1" />
      <circle cx="22" cy="26" r="2" fill="var(--critical)" />
      <circle cx="29" cy="26" r="2" fill="var(--high)" />
      <circle cx="36" cy="26" r="2" fill="var(--low)" />
      <rect x="22" y="34" width="44" height="2" rx="1" fill="var(--border-2)" />
      <rect x="22" y="40" width="34" height="2" rx="1" fill="var(--border-2)" />
      <rect x="22" y="46" width="40" height="2" rx="1" fill="var(--border-2)" />
      <circle cx="62" cy="60" r="14" fill="var(--orange-2)" stroke="var(--bg-1)" strokeWidth="3" />
      <path d="M58 56 L67 60 L58 64 Z" fill="#fff" />
    </svg>
  );
}

/** 취약점 없음 */
export function NoVulnsIllo() {
  return (
    <svg width="88" height="80" viewBox="0 0 88 80" fill="none">
      <circle cx="44" cy="40" r="34" fill="rgba(34,197,94,0.08)" stroke="rgba(34,197,94,0.30)" strokeWidth="1.5" strokeDasharray="3 3" />
      <circle cx="44" cy="40" r="20" fill="var(--low-dim)" stroke="var(--low)" strokeWidth="1.5" />
      <path d="M37 40 L42 45 L52 35" stroke="var(--low)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

/** 필터 결과 없음 */
export function FilterEmptyIllo() {
  return (
    <svg width="88" height="80" viewBox="0 0 88 80" fill="none">
      <path d="M22 16 L66 16 L52 36 L52 56 L36 64 L36 36 Z" fill="var(--bg-3)" stroke="var(--border-2)" strokeWidth="1.5" />
      <circle cx="62" cy="62" r="12" fill="var(--bg-1)" stroke="var(--orange)" strokeWidth="2" />
      <path d="M56 62 L68 62 M62 56 L62 68" stroke="var(--orange)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** 검색 결과 없음 */
export function SearchEmptyIllo() {
  return (
    <svg width="88" height="80" viewBox="0 0 88 80" fill="none">
      <circle cx="38" cy="36" r="20" fill="var(--bg-3)" stroke="var(--border-2)" strokeWidth="1.5" />
      <line x1="53" y1="51" x2="68" y2="66" stroke="var(--border-2)" strokeWidth="3" strokeLinecap="round" />
      <line x1="30" y1="36" x2="46" y2="36" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** 오프라인 / 연결 오류 */
export function OfflineIllo() {
  return (
    <svg width="88" height="80" viewBox="0 0 88 80" fill="none">
      <circle cx="44" cy="40" r="28" fill="var(--bg-3)" stroke="var(--border-2)" strokeWidth="1.5" />
      <path d="M30 40 Q44 28 58 40" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M36 46 Q44 40 52 46" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" fill="none" />
      <circle cx="44" cy="52" r="2.5" fill="var(--critical)" />
      <line x1="22" y1="18" x2="66" y2="62" stroke="var(--critical)" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
