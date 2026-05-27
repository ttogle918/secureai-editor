// components/analysis/ScanModeSelector.tsx
// 스캔 모드 선택 컴포넌트 — Audit(빠른 분석, 저비용) vs Pipeline(정밀 분석, 기본값)
'use client';

export type ScanMode = 'AUDIT' | 'PIPELINE';

interface ScanModeSelectorProps {
  value: ScanMode;
  onChange: (mode: ScanMode) => void;
  disabled?: boolean;
}

interface ModeOption {
  value: ScanMode;
  label: string;
  description: string;
  badgeColor: string;
  badgeBg: string;
  badgeBorder: string;
}

const MODES: ModeOption[] = [
  {
    value: 'PIPELINE',
    label: 'Pipeline 모드',
    description: '정밀 분석 · 기본값',
    badgeColor: '#60a5fa',
    badgeBg: 'rgba(96,165,250,0.1)',
    badgeBorder: 'rgba(96,165,250,0.3)',
  },
  {
    value: 'AUDIT',
    label: 'Audit 모드',
    description: '빠른 분석 · 저비용',
    badgeColor: '#4ade80',
    badgeBg: 'rgba(74,222,128,0.1)',
    badgeBorder: 'rgba(74,222,128,0.3)',
  },
];

export function ScanModeSelector({ value, onChange, disabled = false }: ScanModeSelectorProps) {
  return (
    <div
      role="radiogroup"
      aria-label="스캔 모드 선택"
      style={{ display: 'flex', gap: 8 }}
    >
      {MODES.map((mode) => {
        const isSelected = value === mode.value;
        return (
          <label
            key={mode.value}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 12px',
              borderRadius: 8,
              border: `1px solid ${isSelected ? mode.badgeBorder : 'rgba(255,255,255,0.08)'}`,
              background: isSelected ? mode.badgeBg : 'transparent',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.5 : 1,
              transition: 'all 0.15s',
              userSelect: 'none',
            }}
          >
            <input
              type="radio"
              name="scan-mode"
              value={mode.value}
              checked={isSelected}
              disabled={disabled}
              onChange={() => onChange(mode.value)}
              style={{ display: 'none' }}
            />
            {/* 라디오 원형 인디케이터 */}
            <span
              aria-hidden="true"
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                border: `2px solid ${isSelected ? mode.badgeColor : 'rgba(255,255,255,0.25)'}`,
                background: isSelected ? mode.badgeColor : 'transparent',
                flexShrink: 0,
                transition: 'all 0.15s',
              }}
            />
            <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: isSelected ? mode.badgeColor : 'rgba(255,255,255,0.7)' }}>
                {mode.label}
              </span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
                {mode.description}
              </span>
            </span>
          </label>
        );
      })}
    </div>
  );
}
