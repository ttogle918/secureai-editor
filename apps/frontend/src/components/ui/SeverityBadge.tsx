// components/ui/SeverityBadge.tsx
// 심각도 배지 컴포넌트 (CRITICAL / HIGH / MEDIUM / LOW)
import type { SeverityLevel } from '@/types';
import { SEVERITY_COLORS, SEVERITY_LABELS } from '@/lib/constants/severity';

interface SeverityBadgeProps {
  level: SeverityLevel;
  className?: string;
}

export function SeverityBadge({ level, className }: SeverityBadgeProps) {
  const { text, bg, border } = SEVERITY_COLORS[level];

  return (
    <span
      className={className}
      style={{
        display: 'inline-block',
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '0.5px',
        padding: '2px 6px',
        borderRadius: 3,
        color: text,
        background: bg,
        border: `1px solid ${border}`,
        fontFamily: 'var(--font-mono)',
      }}
    >
      {SEVERITY_LABELS[level].toUpperCase()}
    </span>
  );
}
