// components/ui/ProgressChecklist.tsx
// UI/UX REVISIONS.md §12 — 진행 체크리스트 UI (TASK-406)
'use client';
import { CheckSquare, Square, Loader2, RotateCw } from 'lucide-react';
import type { AnalysisStep } from '@/types';

interface ProgressChecklistProps {
  steps: AnalysisStep[];
  isInterrupted?: boolean;
  onResume?: () => void;
}

export function ProgressChecklist({
  steps,
  isInterrupted = false,
  onResume,
}: ProgressChecklistProps) {
  return (
    <div
      style={{
        background: '#141414',
        border: '1px solid #262626',
        borderRadius: 8,
        padding: 16,
      }}
    >
      <h3
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 13,
          fontWeight: 600,
          color: '#fafafa',
          marginBottom: 12,
        }}
      >
        <CheckSquare size={16} aria-hidden="true" />
        분석 진행 상황
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {steps.map((step) => (
          <div
            key={step.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
            }}
          >
            {step.done ? (
              <CheckSquare
                size={15}
                color="#22c55e"
                aria-hidden="true"
              />
            ) : (
              <Square
                size={15}
                color="#525252"
                aria-hidden="true"
              />
            )}
            <span
              style={{
                color: step.done ? '#a3a3a3' : '#fafafa',
                textDecoration: step.done ? 'line-through' : 'none',
                flex: 1,
              }}
            >
              {step.label}
            </span>
            {step.inProgress && (
              <Loader2
                size={13}
                color="#ea580c"
                aria-label="진행 중"
                style={{ animation: 'spin 0.85s linear infinite', flexShrink: 0 }}
              />
            )}
          </div>
        ))}
      </div>

      {isInterrupted && onResume && (
        <button
          onClick={onResume}
          style={{
            marginTop: 16,
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            background: '#ea580c',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            padding: '9px 0',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'background 0.15s',
          }}
        >
          <RotateCw size={14} aria-hidden="true" />
          분석 재개하기
        </button>
      )}
    </div>
  );
}
