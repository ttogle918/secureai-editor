'use client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { mockDashboardStats } from '@/lib/mockData';

export default function DashboardView() {
  const { trend, critical, high, medium, low, securityScore } = mockDashboardStats;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 보안 점수 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {[
          { label: 'Critical', value: critical, color: '#E24B4A' },
          { label: 'High',     value: high,     color: '#BA7517' },
          { label: 'Medium',   value: medium,   color: '#4ec9b0' },
          { label: 'Score',    value: securityScore, color: '#e2a53a' },
        ].map(s => (
          <div key={s.label} style={{ background: '#141414', border: `0.5px solid ${s.color}22`, borderRadius: 10, padding: '12px 16px' }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* 트렌드 차트 */}
      <div style={{ background: '#141414', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '16px 20px' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', marginBottom: 14 }}>취약점 트렌드 (최근 7일)</div>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={trend} barGap={2}>
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip contentStyle={{ background: '#1a1a1a', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }} />
            <Bar dataKey="critical" fill="#E24B4A" radius={[3,3,0,0]} maxBarSize={14} />
            <Bar dataKey="high"     fill="#BA7517" radius={[3,3,0,0]} maxBarSize={14} />
            <Bar dataKey="medium"   fill="#4ec9b0" radius={[3,3,0,0]} maxBarSize={14} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
