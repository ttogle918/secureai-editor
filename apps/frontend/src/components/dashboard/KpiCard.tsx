// components/dashboard/KpiCard.tsx
// KPI 수치 카드 컴포넌트
interface KpiCardProps {
  value: string | number;
  label: string;
  color?: string;
  isScore?: boolean;
}

export function KpiCard({ value, label, color = '#f97316', isScore = false }: KpiCardProps) {
  return (
    <div
      style={{
        background: isScore ? 'rgba(249,115,22,0.05)' : '#111114',
        border: `1px solid ${isScore ? 'rgba(249,115,22,0.3)' : '#1f1f24'}`,
        borderRadius: 6,
        padding: '16px 12px',
        textAlign: 'center',
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: 28,
          fontWeight: 700,
          color,
          lineHeight: 1,
          marginBottom: 6,
          letterSpacing: '-0.02em',
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 10,
          color: '#555560',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
    </div>
  );
}
