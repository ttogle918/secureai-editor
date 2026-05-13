// components/ui/ProgressPanel.tsx
// TASK-406 — 진행률 패널: 진행 바 + 단계 목록 + Markdown 다운로드
'use client';
import { CheckSquare } from 'lucide-react';
import { useSecureStore, type ProgressStep } from '@/store/useSecureStore';

// ── status 아이콘 ────────────────────────────────────────────
function StatusIcon({ status }: { status: ProgressStep['status'] }) {
  if (status === 'completed') {
    return (
      <span style={{ color: '#22c55e', fontSize: 13, lineHeight: 1 }} aria-label="완료">
        ✓
      </span>
    );
  }
  if (status === 'running') {
    return (
      <span
        style={{
          display: 'inline-block',
          color: '#ea580c',
          fontSize: 13,
          lineHeight: 1,
          animation: 'spin 0.85s linear infinite',
        }}
        aria-label="진행 중"
      >
        ⟳
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span style={{ color: '#ef4444', fontSize: 13, lineHeight: 1 }} aria-label="오류">
        ✗
      </span>
    );
  }
  // pending
  return (
    <span style={{ color: 'rgba(255,255,255,0.28)', fontSize: 13, lineHeight: 1 }} aria-label="대기">
      ○
    </span>
  );
}

// ── Markdown 생성 ────────────────────────────────────────────
function generateMarkdown(steps: ProgressStep[]): string {
  const completed = steps.filter((s) => s.status === 'completed').length;
  const total = steps.length;
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);

  const lines = [
    `# 보안 분석 진행률 — ${new Date().toLocaleDateString('ko-KR')}`,
    '',
    `**진행률**: ${completed}/${total} (${pct}%)`,
    '',
    '## 분석 단계',
    ...steps.map((s) => {
      const check = s.status === 'completed' ? '[x]' : '[ ]';
      const dur = s.durationMs !== undefined ? ` _(${s.durationMs}ms)_` : '';
      return `- ${check} **${s.stepName}** — ${s.target}${dur}`;
    }),
  ];
  return lines.join('\n');
}

// ── 다운로드 핸들러 ──────────────────────────────────────────
function downloadMarkdown(steps: ProgressStep[]): void {
  const blob = new Blob([generateMarkdown(steps)], { type: 'text/markdown' });
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(blob);
  anchor.download = `security-progress-${Date.now()}.md`;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
}

// ── 메인 컴포넌트 ────────────────────────────────────────────
export function ProgressPanel() {
  const progressSteps = useSecureStore((s) => s.progressSteps);

  const total = progressSteps.length;
  const completed = progressSteps.filter((s) => s.status === 'completed').length;
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: '12px 16px',
        overflowY: 'auto',
        flex: 1,
        minHeight: 0,
      }}
    >
      {/* 진행률 요약 */}
      <div
        style={{
          background: '#0f0f0f',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 8,
          padding: 12,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 600, color: '#e8e8ee' }}>진행률</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
            {completed} / {total} 완료 ({pct}%)
          </span>
        </div>

        {/* 진행률 바 */}
        <div
          style={{
            height: 6,
            background: 'rgba(255,255,255,0.08)',
            borderRadius: 3,
            overflow: 'hidden',
          }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`진행률 ${pct}%`}
        >
          <div
            style={{
              height: '100%',
              width: `${pct}%`,
              background: '#ea580c',
              borderRadius: 3,
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>

      {/* 단계 목록 */}
      <div
        style={{
          background: '#0f0f0f',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 8,
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 600, color: '#e8e8ee', marginBottom: 4 }}>
          분석 단계
        </span>
        {progressSteps.map((step) => (
          <div
            key={step.stepOrder}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 11,
              color: 'rgba(255,255,255,0.7)',
            }}
          >
            <StatusIcon status={step.status} />
            <span style={{ flex: 1 }}>
              <span style={{ fontWeight: 500, color: '#e8e8ee' }}>{step.stepName}</span>
              {' '}
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>{step.target}</span>
            </span>
            {step.durationMs !== undefined && (
              <span style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>
                {step.durationMs}ms
              </span>
            )}
          </div>
        ))}
      </div>

      {/* 다운로드 버튼 */}
      <button
        onClick={() => downloadMarkdown(progressSteps)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          padding: '8px 12px',
          background: 'rgba(234,88,12,0.12)',
          border: '1px solid rgba(234,88,12,0.3)',
          borderRadius: 6,
          color: '#ea580c',
          fontSize: 11,
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'background 0.15s',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(234,88,12,0.22)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(234,88,12,0.12)';
        }}
      >
        <CheckSquare size={12} aria-hidden="true" />
        체크리스트 다운로드
      </button>
    </div>
  );
}
