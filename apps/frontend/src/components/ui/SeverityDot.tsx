// components/ui/SeverityDot.tsx
// UI/UX REVISIONS.md §1 — 이모지 아이콘 전체 교체
import type { SeverityLevel } from '@/types';
import { SEVERITY_COLORS } from '@/lib/constants/severity';

interface SeverityDotProps {
  level: SeverityLevel;
  /** 크기 px (기본 7) */
  size?: number;
  /** aria-label 오버라이드 (기본 = "{level} severity") */
  'aria-label'?: string;
}

export function SeverityDot({
  level,
  size = 7,
  'aria-label': ariaLabel,
}: SeverityDotProps) {
  const { dot, glow } = SEVERITY_COLORS[level];

  return (
    <span
      role="img"
      aria-label={ariaLabel ?? `${level} severity`}
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: dot,
        boxShadow: level === 'critical' ? glow : undefined,
        flexShrink: 0,
      }}
    />
  );
}
