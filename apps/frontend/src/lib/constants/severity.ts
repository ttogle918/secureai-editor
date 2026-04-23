import type { SeverityLevel } from '@/types';

// ── 와이어프레임 기반 심각도별 색상/스타일 매핑 ──────────

export const SEVERITY_COLORS: Record<SeverityLevel, {
  text: string;
  bg: string;
  border: string;
  glow: string;
  dot: string;
}> = {
  critical: {
    text:   '#e24b4b',
    bg:     'rgba(226, 75, 75, 0.10)',
    border: 'rgba(226, 75, 75, 0.30)',
    glow:   '0 0 8px rgba(226, 75, 75, 0.40)',
    dot:    '#e24b4b',
  },
  high: {
    text:   '#f59e0b',
    bg:     'rgba(245, 158, 11, 0.10)',
    border: 'rgba(245, 158, 11, 0.30)',
    glow:   '0 0 6px rgba(245, 158, 11, 0.30)',
    dot:    '#f59e0b',
  },
  medium: {
    text:   '#eab308',
    bg:     'rgba(234, 179, 8, 0.10)',
    border: 'rgba(234, 179, 8, 0.30)',
    glow:   '0 0 6px rgba(234, 179, 8, 0.25)',
    dot:    '#eab308',
  },
  low: {
    text:   '#22c55e',
    bg:     'rgba(34, 197, 94, 0.08)',
    border: 'rgba(34, 197, 94, 0.25)',
    glow:   '0 0 5px rgba(34, 197, 94, 0.20)',
    dot:    '#22c55e',
  },
  info: {
    text:   '#569cd6',
    bg:     'rgba(86, 156, 214, 0.08)',
    border: 'rgba(86, 156, 214, 0.25)',
    glow:   'none',
    dot:    '#569cd6',
  },
};

export const SEVERITY_LABELS: Record<SeverityLevel, string> = {
  critical: 'Critical',
  high:     'High',
  medium:   'Medium',
  low:      'Low',
  info:     'Info',
};

export const SEVERITY_ORDER: SeverityLevel[] = ['critical', 'high', 'medium', 'low', 'info'];
