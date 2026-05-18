// components/brand/PagoriBrand.tsx
// Pagori 마크 + 워드마크 lockup — 에디터/대시보드/온보딩 헤더에 모두 사용
'use client';
import Image from 'next/image';

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
