// ── 태블로 스타일 보안 대시보드 ─────────────────────────────
'use client';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { CheckCircle, XCircle } from 'lucide-react';
import { mockDashboardStats, mockGithubPRs, mockVulnerabilities } from '@/lib/mockData';
import { useAppStore } from '@/store/appStore';
import FilterBar from '@/components/ui/FilterBar';
import VulnDetailPanel from '@/components/analysis/VulnDetailPanel';

const SEV_COLOR: Record<string, string> = {
  critical: '#E24B4A', high: '#BA7517', medium: '#4ec9b0', low: '#608b4e',
};

const PR_LABEL: Record<string, string> = {
  pass: '통과', fail: '실패', warning: '경고', running: '분석중',
};
const PR_COLOR: Record<string, string> = {
  pass: '#4caf50', fail: '#E24B4A', warning: '#BA7517', running: '#378ADD',
};

function KpiCard({ label, value, color, sub }: { label: string; value: string | number; color: string; sub?: string }) {
  return (
    <div style={{ background: '#141414', border: `0.5px solid ${color}22`, borderTop: `2px solid ${color}`, borderRadius: 10, padding: '14px 18px' }}>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export default function DashboardPage() {
  const { totalVulns, critical, high, medium, low, patched, securityScore, trend, owaspCoverage, fileHeatmap } = mockDashboardStats;
  const filteredVulns = useAppStore(s => s.filteredVulns());

  const scoreColor = securityScore >= 80 ? '#4caf50' : securityScore >= 60 ? '#BA7517' : '#E24B4A';

  // 심각도 분포 차트 데이터
  const sevData = [
    { name: 'Critical', value: critical, color: '#E24B4A' },
    { name: 'High',     value: high,     color: '#BA7517' },
    { name: 'Medium',   value: medium,   color: '#4ec9b0' },
    { name: 'Low',      value: low,      color: '#608b4e' },
  ];

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: '#0d0d0d', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '28px 32px', maxWidth: 1200, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* ── 헤더 ── */}
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 20 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em', marginBottom: 4 }}>Security Audit Dashboard</h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>프로젝트 전체 보안 현황 — 보고서용 시각화</p>
        </div>

        {/* ── KPI 카드 ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
          <KpiCard label="보안 점수"    value={securityScore} color={scoreColor} sub="/ 100" />
          <KpiCard label="Critical"    value={critical}      color="#E24B4A" />
          <KpiCard label="High"        value={high}          color="#BA7517" />
          <KpiCard label="Medium"      value={medium}        color="#4ec9b0" />
          <KpiCard label="패치 완료"   value={`${patched} / ${totalVulns}`} color="#4caf50" sub={`${Math.round(patched/totalVulns*100)}%`} />
        </div>

        {/* ── 차트 2열 ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 16 }}>
          {/* 심각도 분포 */}
          <div style={{ background: '#141414', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', marginBottom: 14 }}>심각도 분포</div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={sevData} barSize={32}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.4)' }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ background: '#1a1a1a', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }}
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {sevData.map((d, i) => <Cell key={i} fill={d.color} fillOpacity={0.85} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 보안 점수 트렌드 */}
          <div style={{ background: '#141414', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', marginBottom: 14 }}>보안 점수 트렌드 (7일)</div>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#4caf50" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#4caf50" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} />
                <YAxis domain={[30, 100]} tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} width={28} />
                <Tooltip
                  contentStyle={{ background: '#1a1a1a', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }}
                />
                <Area type="monotone" dataKey="score" stroke="#4caf50" strokeWidth={2} fill="url(#scoreGrad)" dot={{ r: 3, fill: '#4caf50' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── 파일별 히트맵 ── */}
        <div style={{ background: '#141414', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '16px 20px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', marginBottom: 14 }}>파일별 취약점 히트맵</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {fileHeatmap.map(f => (
              <div key={f.file} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'rgba(255,255,255,0.6)', width: 160, flexShrink: 0 }}>{f.file}</div>
                <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 4,
                    width: `${Math.round((f.count / 3) * 100)}%`,
                    background: SEV_COLOR[f.severity],
                    opacity: 0.85,
                    transition: 'width 0.4s ease',
                  }} />
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: SEV_COLOR[f.severity], width: 20, textAlign: 'right' }}>{f.count}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── OWASP Top 10 커버리지 ── */}
        <div style={{ background: '#141414', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '16px 20px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', marginBottom: 14 }}>OWASP Top 10 커버리지</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
            {mockDashboardStats.owaspCoverage.map(o => (
              <div key={o.id} style={{
                padding: '8px 10px', borderRadius: 8,
                background: o.hit ? 'rgba(226,75,74,0.08)' : 'rgba(255,255,255,0.03)',
                border: `0.5px solid ${o.hit ? 'rgba(226,75,74,0.25)' : 'rgba(255,255,255,0.06)'}`,
                display: 'flex', flexDirection: 'column', gap: 4,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: o.hit ? '#E24B4A' : 'rgba(255,255,255,0.4)' }}>{o.id}</span>
                  {o.hit
                    ? <XCircle size={12} color="#E24B4A" />
                    : <CheckCircle size={12} color="#4caf50" />}
                </div>
                <span style={{ fontSize: 9, color: o.hit ? 'rgba(248,113,113,0.7)' : 'rgba(255,255,255,0.25)', lineHeight: 1.4 }}>{o.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── 취약점 상세 목록 (필터 포함) ── */}
        <div style={{ background: '#141414', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '0.5px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>취약점 상세 목록</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{filteredVulns.length}개 표시 중</span>
          </div>
          <FilterBar />
          <VulnDetailPanel />
        </div>

        {/* ── GitHub PR 이력 ── */}
        <div style={{ background: '#141414', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden', marginBottom: 8 }}>
          <div style={{ padding: '14px 20px', borderBottom: '0.5px solid rgba(255,255,255,0.06)', fontSize: 13, fontWeight: 600, color: '#fff' }}>
            GitHub Actions — PR 보안 점검 이력
          </div>
          {mockGithubPRs.map(pr => (
            <div key={pr.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 20px', borderBottom: '0.5px solid rgba(255,255,255,0.04)', fontSize: 12 }}>
              <span style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 4, fontWeight: 700, flexShrink: 0,
                background: `${PR_COLOR[pr.status]}18`, color: PR_COLOR[pr.status],
                border: `0.5px solid ${PR_COLOR[pr.status]}30`,
              }}>
                {PR_LABEL[pr.status]}
              </span>
              <span style={{ flex: 1, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.7)' }}>
                PR #{pr.number} · {pr.title}
              </span>
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>{pr.detail}</span>
              <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, flexShrink: 0 }}>{pr.time}</span>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
