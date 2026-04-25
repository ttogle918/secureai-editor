// components/dashboard/DashboardPage.tsx
// 태블로 스타일 보안 대시보드 — 신규 컴포넌트 조합
'use client';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { useMemo } from 'react';
import { CheckCircle, XCircle, Github } from 'lucide-react';

import { mockDashboardStats, mockGithubPRs } from '@/lib/mockData';
import { useSecureStore } from '@/store/useSecureStore';
import FilterBar            from '@/components/ui/FilterBar';
import VulnDetailPanel      from '@/components/analysis/VulnDetailPanel';
import { KpiCard }             from '@/components/dashboard/KpiCard';
import { SecurityScoreRing }   from '@/components/dashboard/SecurityScoreRing';
import { SeverityBarChart }    from '@/components/dashboard/SeverityBarChart';
import { TrendLineChart }      from '@/components/dashboard/TrendLineChart';
import { FileHeatmap }         from '@/components/dashboard/FileHeatmap';
import { OwaspCoverageMatrix } from '@/components/dashboard/OwaspCoverageMatrix';

// ── PR 배지 스타일 ────────────────────────────────────────
const PR_COLOR: Record<string, string> = {
  pass: '#22c55e', fail: '#f04141', warning: '#f59e0b', running: '#569cd6',
};
const PR_LABEL: Record<string, string> = {
  pass: '통과', fail: '실패', warning: '경고', running: '분석중',
};

// ── Card wrapper ─────────────────────────────────────────
function Card({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <div
      style={{
        background: '#111114',
        border: '1px solid #1f1f24',
        borderRadius: 8,
        padding: '16px 20px',
      }}
    >
      {title && (
        <div style={{ fontSize: 11, color: '#9494a0', marginBottom: 14 }}>
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

export default function DashboardPage() {
  const { critical, high, medium, low, patched, totalVulns, securityScore, trend, fileHeatmap } =
    mockDashboardStats;
  const vulns = useSecureStore((s) => s.vulns);
  const severityFilter = useSecureStore((s) => s.severityFilter);
  const apiGroupFilter = useSecureStore((s) => s.apiGroupFilter);

  const filteredVulns = useMemo(() => {
    return vulns.filter((v) => {
      const sevOk = severityFilter === 'all' || v.severity === severityFilter;
      const apiOk =
        !apiGroupFilter ||
        (v.apiGroup
          ? v.apiGroup === apiGroupFilter || v.apiGroup.startsWith(apiGroupFilter + '/')
          : apiGroupFilter === 'other');
      return sevOk && apiOk;
    });
  }, [vulns, severityFilter, apiGroupFilter]);

  const scoreColor =
    securityScore >= 80 ? '#22c55e' :
    securityScore >= 60 ? '#f97316' :
    '#f04141';

  // OWASP bar chart data
  const owaspRows = [
    { label: 'Injection',     count: critical, maxCount: 5, color: '#f04141' },
    { label: 'Auth Failure',  count: high,     maxCount: 5, color: '#f59e0b' },
    { label: 'XSS',           count: high,     maxCount: 5, color: '#f59e0b' },
    { label: 'Access Control',count: medium,   maxCount: 5, color: '#eab308' },
    { label: 'Misc Config',   count: 1,        maxCount: 5, color: '#eab308' },
  ];

  // trend data for TrendLineChart
  const trendPoints = trend.map((t) => ({ date: t.date, score: t.score ?? 60 }));

  // file heatmap cells
  // fileHeatmap.severity is 'critical'|'high'|'low' in mock; cast to string for safe comparison
  const heatmapCells = fileHeatmap.map((f) => {
    const sev = f.severity as string;
    return {
      file:     f.file,
      critical: sev === 'critical' ? f.count : 0,
      high:     sev === 'high'     ? f.count : 0,
      medium:   sev === 'medium'   ? f.count : 0,
      low:      sev === 'low'      ? f.count : 0,
    };
  });

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        background: '#0d0d0f',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          padding: '24px 28px',
          maxWidth: 1280,
          margin: '0 auto',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {/* ── 헤더 ── */}
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 16 }}>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: '#e8e8ee',
              letterSpacing: '-0.02em',
              marginBottom: 4,
            }}
          >
            Security Audit Dashboard
          </h1>
          <p style={{ fontSize: 11, color: '#555560', fontFamily: 'var(--font-mono)' }}>
            프로젝트: secureai-frontend · 마지막 분석: 방금 전
          </p>
        </div>

        {/* ── KPI 카드 ── */}
        <div
          style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}
          aria-label="주요 보안 지표"
        >
          <KpiCard value={securityScore} label="보안 점수"  color={scoreColor} isScore />
          <KpiCard value={critical}      label="Critical"   color="#f04141" />
          <KpiCard value={high}          label="High"       color="#f59e0b" />
          <KpiCard value={medium}        label="Medium"     color="#eab308" />
          <KpiCard
            value={`${Math.round((patched / totalVulns) * 100)}%`}
            label="패치 완료율"
            color="#22c55e"
          />
        </div>

        {/* ── 차트 2열 ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 12 }}>
          <Card title="심각도 분포 (OWASP 분류)">
            <SeverityBarChart rows={owaspRows} />
          </Card>
          <Card title="보안 점수 트렌드 (7일)">
            <TrendLineChart data={trendPoints} height={80} />
          </Card>
        </div>

        {/* ── 파일별 히트맵 ── */}
        <Card title="파일별 취약점 히트맵">
          <FileHeatmap cells={heatmapCells} />
        </Card>

        {/* ── OWASP Coverage ── */}
        <Card title="OWASP Top 10 커버리지 (A01 ~ A10)">
          <OwaspCoverageMatrix />
        </Card>

        {/* ── 취약점 상세 목록 ── */}
        <div
          style={{
            background: '#111114',
            border: '1px solid #1f1f24',
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: '#e8e8ee' }}>
              취약점 상세 목록
            </span>
            <span style={{ fontSize: 11, color: '#555560' }}>
              {filteredVulns.length}개 표시 중
            </span>
          </div>
          <FilterBar />
          <VulnDetailPanel />
        </div>

        {/* ── GitHub PR 이력 ── */}
        <div
          style={{
            background: '#111114',
            border: '1px solid #1f1f24',
            borderRadius: 8,
            overflow: 'hidden',
            marginBottom: 8,
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              fontWeight: 600,
              color: '#e8e8ee',
            }}
          >
            <Github size={15} aria-hidden="true" />
            GitHub PR 보안 리뷰 이력
          </div>
          <div role="list" aria-label="PR 보안 리뷰 목록">
            {mockGithubPRs.map((pr) => (
              <div
                key={pr.id}
                role="listitem"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 16px',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  fontSize: 12,
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontWeight: 700,
                    flexShrink: 0,
                    background: `${PR_COLOR[pr.status]}18`,
                    color: PR_COLOR[pr.status],
                    border: `0.5px solid ${PR_COLOR[pr.status]}30`,
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {PR_LABEL[pr.status]}
                </span>
                <span
                  style={{
                    flex: 1,
                    fontFamily: 'var(--font-mono)',
                    color: '#9494a0',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  PR #{pr.number} · {pr.title}
                </span>
                <span style={{ color: '#555560', fontSize: 11, flexShrink: 0 }}>
                  {pr.detail}
                </span>
                <span style={{ color: '#555560', fontSize: 11, flexShrink: 0 }}>
                  {pr.time}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
