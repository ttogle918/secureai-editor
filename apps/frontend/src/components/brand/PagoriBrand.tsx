// components/brand/PagoriBrand.tsx
// Pagori 마크 + 워드마크 lockup — 에디터/대시보드/온보딩 헤더에 모두 사용
'use client';
import Image from 'next/image';
import type { WorkspaceMode } from '@/store/useAuthStore';

interface PagoriMarkProps {
  size?: number;
  className?: string;
}

export function PagoriMark({ size = 24, className }: PagoriMarkProps) {
  return (
    <Image
      src="/pagori-mark.png"
      alt="Pagori"
      width={size}
      height={size}
      priority
      className={className}
      style={{ objectFit: 'contain' }}
    />
  );
}

interface PagoriLockupProps {
  size?: number;
  subtitle?: string;
  color?: string;
}

/**
 * ModeIndicator — 워크스페이스 모드 배지 (헤더 또는 독립 사용)
 * compact=true  → 작은 칩 (헤더용)
 * 개발자: ⬡ DEV (orange), 보안 관리자: 🛡 SEC MGR (indigo/tag-1)
 */
interface ModeIndicatorProps {
  mode: WorkspaceMode;
  compact?: boolean;
}

export function ModeIndicator({ mode, compact = false }: ModeIndicatorProps) {
  const isSec = mode === 'SECURITY_MANAGER';
  const isBoth = mode === 'BOTH';
  const label = isBoth ? '⬢ BOTH' : isSec ? '🛡 SEC MGR' : '⬡ DEV';
  const color = isSec ? 'var(--tag-1)' : 'var(--orange)';
  const bg    = isSec ? 'rgba(129,140,248,0.12)' : 'var(--orange-dim)';
  const border = isSec ? 'rgba(129,140,248,0.30)' : 'rgba(249,115,22,0.30)';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: compact ? 3 : 5,
        padding: compact ? '2px 7px' : '3px 10px',
        borderRadius: compact ? 4 : 6,
        fontSize: compact ? 9 : 11,
        fontWeight: 700,
        fontFamily: 'var(--font-mono)',
        letterSpacing: '0.04em',
        background: bg,
        color,
        border: `1px solid ${border}`,
        userSelect: 'none',
        flexShrink: 0,
      }}
      title={isBoth ? '통합 모드' : isSec ? '보안 관리자 모드 (읽기 전용)' : '개발자 모드'}
    >
      {label}
    </span>
  );
}

/**
 * Mark + wordmark lockup. Pass `subtitle` to add the "security audit agent" tagline
 * (used on the onboarding header).
 */
export function PagoriLockup({ size = 22, subtitle, color = 'var(--text-primary)' }: PagoriLockupProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <PagoriMark size={size} />
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
        <span
          style={{
            fontSize: Math.round(size * 0.62),
            fontWeight: 700,
            letterSpacing: '-0.01em',
            color,
            fontFamily: 'var(--font-sans)',
          }}
        >
          pagori
        </span>
        {subtitle && (
          <span
            style={{
              fontSize: Math.round(size * 0.4),
              color: 'var(--text-tertiary)',
              marginTop: 3,
              letterSpacing: '0.04em',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}
