// ── 심각도 분포 바 차트 ──────────────────────────────────────
'use client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const SEV_DATA = [
  { name: 'Critical', key: 'critical', color: '#E24B4A' },
  { name: 'High',     key: 'high',     color: '#BA7517' },
  { name: 'Medium',   key: 'medium',   color: '#4ec9b0' },
  { name: 'Low',      key: 'low',      color: '#608b4e' },
];

interface Props {
  critical: number;
  high:     number;
  medium:   number;
  low:      number;
}

export function SeverityBarChart({ critical, high, medium, low }: Props) {
  const data = [
    { name: 'Critical', value: critical, color: '#E24B4A' },
    { name: 'High',     value: high,     color: '#BA7517' },
    { name: 'Medium',   value: medium,   color: '#4ec9b0' },
    { name: 'Low',      value: low,      color: '#608b4e' },
  ];

  return (
    <div style={{ background: '#141414', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '16px 20px' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', marginBottom: 14 }}>심각도 분포</div>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} barSize={32}>
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.4)' }} axisLine={false} tickLine={false} />
          <YAxis hide />
          <Tooltip
            contentStyle={{ background: '#1a1a1a', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }}
            cursor={{ fill: 'rgba(255,255,255,0.03)' }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {data.map((d, i) => <Cell key={i} fill={d.color} fillOpacity={0.85} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
