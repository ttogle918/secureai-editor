// ── KPI 카드 ─────────────────────────────────────────────────
'use client';

interface KpiCardProps {
  label: string;
  value: string | number;
  color: string;
  sub?: string;
}

export function KpiCard({ label, value, color, sub }: KpiCardProps) {
  return (
    <div style={{
      background: '#141414',
      border: `0.5px solid ${color}22`,
      borderTop: `2px solid ${color}`,
      borderRadius: 10,
      padding: '14px 18px',
    }}>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}
