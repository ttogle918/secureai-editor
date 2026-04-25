// components/ui/EmptyState.tsx
// UI/UX REVISIONS.md §9 — 로딩·에러 상태 표준화
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div
      role="status"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: '40px 24px',
        textAlign: 'center',
        color: 'var(--text-tertiary)',
      }}
    >
      {icon && (
        <span
          aria-hidden="true"
          style={{ fontSize: 32, color: 'var(--text-tertiary)', opacity: 0.6 }}
        >
          {icon}
        </span>
      )}
      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
        {title}
      </p>
      {description && (
        <p style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.6, maxWidth: 240 }}>
          {description}
        </p>
      )}
      {action && <div style={{ marginTop: 4 }}>{action}</div>}
    </div>
  );
}
