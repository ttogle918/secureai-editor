'use client';
import { type Severity } from '@/lib/mockData';

const MAP: Record<Severity, { bg: string; text: string; border: string; label: string }> = {
  critical: { bg: 'rgba(226,75,74,0.12)',  text: '#E24B4A', border: 'rgba(226,75,74,0.3)',  label: 'Critical' },
  high:     { bg: 'rgba(186,117,23,0.12)', text: '#BA7517', border: 'rgba(186,117,23,0.3)', label: 'High'     },
  medium:   { bg: 'rgba(78,201,176,0.12)', text: '#4ec9b0', border: 'rgba(78,201,176,0.3)', label: 'Medium'   },
  low:      { bg: 'rgba(96,139,78,0.12)',  text: '#608b4e', border: 'rgba(96,139,78,0.3)',  label: 'Low'      },
};

export const SEVERITY_COLORS = MAP;

interface Props {
  severity: Severity;
  size?: 'sm' | 'md';
}

export default function SeverityBadge({ severity, size = 'sm' }: Props) {
  const c = MAP[severity];
  return (
    <span style={{
      fontSize: size === 'sm' ? 10 : 12,
      padding: size === 'sm' ? '2px 8px' : '3px 10px',
      borderRadius: 4,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      background: c.bg,
      color: c.text,
      border: `0.5px solid ${c.border}`,
      flexShrink: 0,
    }}>
      {c.label}
    </span>
  );
}
