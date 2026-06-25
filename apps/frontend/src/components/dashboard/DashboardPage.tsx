// components/dashboard/DashboardPage.tsx
'use client';
import { useMemo, useState } from 'react';
import { BarChart2, PieChart, FileText, RefreshCw, Key, Package, Github, Clock3, CreditCard, ClipboardList, Activity, ChevronRight, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PdfReportModal }         from '@/components/analysis/PdfReportModal';
import { useSecureStore }         from '@/store/useSecureStore';
import { useDashboard }           from '@/hooks/useDashboard';
import { useCredits }             from '@/hooks/useCredits';
import FilterBar                  from '@/components/ui/FilterBar';
import VulnDetailPanel            from '@/components/analysis/VulnDetailPanel';
import { KpiCard }                from '@/components/dashboard/KpiCard';
import { SeverityBarChart }       from '@/components/dashboard/SeverityBarChart';
import { TrendLineChart }         from '@/components/dashboard/TrendLineChart';
import { FileHeatmap }            from '@/components/dashboard/FileHeatmap';
import { OwaspCoverageMatrix }    from '@/components/dashboard/OwaspCoverageMatrix';
import { EmptyState }             from '@/components/ui/EmptyState';
import { isVulnResolved }         from '@/lib/mockData';

// ── 대시보드 색상 상수 ────────────────────────────────────────────
const DASH_COLORS = {
  credits:      '#f97316',   // 오렌지 — 크레딧
  compliance:   '#569cd6',   // 블루 — 컴플라이언스
  monitoring:   '#a78bfa',   // 퍼플 — 도메인 모니터링
  secretScan:   '#34d399',   // 그린 — 시크릿 스캔
  sbom:         '#818cf8',   // 인디고 — SBOM
  disabled:     'rgba(255,255,255,0.2)',
} as const;

type DateRange    = '24h' | '7d' | '30d' | '90d' | 'all';
type DashViewMode = 'executive' | 'analyst';

function DateRangeBar({ value, onChange }: { value: DateRange; onChange: (v: DateRange) => void }) {
  const ranges: Array<{ id: DateRange; label: string }> = [
    { id: '24h', label: '24h' },
    { id: '7d',  label: '7일' },
    { id: '30d', label: '30일' },
    { id: '90d', label: '90일' },
    { id: 'all', label: '전체' },
  ];
  return (
    <div style={{
      display: 'flex', height: 28, padding: 2,
      background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 7,
    }}>
      {ranges.map((r) => (
        <button
          key={r.id}
          onClick={() => onChange(r.id)}
          style={{
            padding: '0 12px', borderRadius: 5, border: 'none',
            background: value === r.id ? 'var(--bg-1)' : 'transparent',
            color: value === r.id ? 'var(--text-primary)' : 'var(--text-tertiary)',
            fontSize: 11, fontWeight: 600, cursor: 'pointer',
            boxShadow: value === r.id ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
            transition: 'background 0.12s, color 0.12s',
          }}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

function ViewToggle({ value, onChange }: { value: DashViewMode; onChange: (v: DashViewMode) => void }) {
  return (
    <div style={{
      display: 'flex', height: 28, padding: 2,
      background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 7,
    }}>
      {([
        { id: 'executive' as DashViewMode, label: '요약',  Icon: PieChart },
        { id: 'analyst'   as DashViewMode, label: '상세',  Icon: BarChart2 },
      ]).map(({ id, label, Icon }) => {
        const active = value === id;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            style={{
              padding: '0 12px', borderRadius: 5, border: 'none',
              background: active ? 'var(--bg-1)' : 'transparent',
              color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',
              fontSize: 11, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              boxShadow: active ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
              transition: 'background 0.12s, color 0.12s',
            }}
          >
            <Icon size={11} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

function Card({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <div style={{
      background: 'var(--bg-2)', border: '1px solid var(--border)',
      borderRadius: 8, padding: '16px 20px',
    }}>
      {title && (
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 14 }}>{title}</div>
      )}
      {children}
    </div>
  );
}

function InlineEmpty({ label }: { label: string }) {
  return (
    <div style={{
      height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 11, color: 'var(--text-disabled)', fontFamily: 'var(--font-mono)',
    }}>
      {label}
    </div>
  );
}

// ── API 연결 상태 칩 ─────────────────────────────────────────────
function ApiStatusChip({ isLoading, isLive, error, onRefetch }: {
  isLoading: boolean;
  isLive:    boolean;
  error:     string | null;
  onRefetch: () => void;
}) {
  if (isLoading) {
    return (
      <span style={{
        display: 'flex', alignItems: 'center', gap: 5,
        fontSize: 10, color: 'var(--text-tertiary)',
        fontFamily: 'var(--font-mono)',
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: 3,
          background: 'var(--orange-2)',
          animation: 'pulse-dot 1.4s infinite',
        }} />
        불러오는 중
      </span>
    );
  }
  if (error) {
    return (
      <button
        onClick={onRefetch}
        title={error}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          fontSize: 10, color: 'var(--critical)',
          fontFamily: 'var(--font-mono)',
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        }}
      >
        <RefreshCw size={10} />
        로드 실패 — 재시도
      </button>
    );
  }
  if (isLive) {
    return (
      <span style={{
        display: 'flex', alignItems: 'center', gap: 5,
        fontSize: 10, color: 'var(--low)',
        fontFamily: 'var(--font-mono)',
      }}>
        <span style={{ width: 6, height: 6, borderRadius: 3, background: 'var(--low)' }} />
        실시간
      </span>
    );
  }
  return null;
}

export default function DashboardPage() {
  const router = useRouter();
  const [dateRange,    setDateRange]    = useState<DateRange>('7d');
  const [dashView,     setDashView]     = useState<DashViewMode>('executive');
  const [showPdfModal, setShowPdfModal] = useState(false);

  // ── 로컬 스토어 (로컬 분석 결과 기반) ──────────────────────────
  const vulns           = useSecureStore((s) => s.vulns);
  const severityFilter  = useSecureStore((s) => s.severityFilter);
  const apiGroupFilter  = useSecureStore((s) => s.apiGroupFilter);
  const lastTokenUsage  = useSecureStore((s) => s.lastTokenUsage);
  const projectId       = useSecureStore((s) => s.projectId);

  // ── 크레딧 실데이터 ─────────────────────────────────────────────
  const { data: creditsData, isLoading: creditsLoading } = useCredits();

  // ── 백엔드 대시보드 API ─────────────────────────────────────────
  const { data: apiData, isLoading, error, refetch } = useDashboard(projectId);
  const isApiLive = !!apiData && !isLoading && !error;

  // ── 필터링된 취약점 (취약점 상세 목록 용) ─────────────────────
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

  // ── KPI — API 우선, 없으면 로컬 store 계산값 ─────────────────
  const localCritical = useMemo(() => vulns.filter((v) => v.severity === 'critical').length, [vulns]);
  const localHigh     = useMemo(() => vulns.filter((v) => v.severity === 'high').length,     [vulns]);
  const localMedium   = useMemo(() => vulns.filter((v) => v.severity === 'medium').length,   [vulns]);
  const localLow      = useMemo(() => vulns.filter((v) => v.severity === 'low').length,      [vulns]);
  const localTotal    = vulns.length;
  const patched       = useMemo(() => vulns.filter((v) => isVulnResolved(v.status)).length, [vulns]);

  const critical   = isApiLive ? apiData.critical   : localCritical;
  const high       = isApiLive ? apiData.high        : localHigh;
  const medium     = isApiLive ? apiData.medium      : localMedium;
  const low        = isApiLive ? apiData.low         : localLow;
  const totalVulns = isApiLive ? apiData.totalVulns  : localTotal;

  const localScore = useMemo(() => {
    if (localTotal === 0) return 100;
    const penalty = localCritical * 15 + localHigh * 5 + localMedium * 2 + localLow * 0.5;
    return Math.max(0, Math.min(100, Math.round(100 - penalty)));
  }, [localCritical, localHigh, localMedium, localLow, localTotal]);

  const securityScore = isApiLive ? apiData.securityScore : localScore;
  const scoreColor =
    securityScore >= 80 ? 'var(--low)' :
    securityScore >= 60 ? 'var(--orange)' :
    'var(--critical)';

  // ── 파일 히트맵 — API 우선, 없으면 로컬 계산 ─────────────────
  const localHeatmap = useMemo(() => {
    const map: Record<string, { critical: number; high: number; medium: number; low: number }> = {};
    for (const v of vulns) {
      if (!map[v.filePath]) map[v.filePath] = { critical: 0, high: 0, medium: 0, low: 0 };
      if (v.severity === 'critical' || v.severity === 'high' || v.severity === 'medium' || v.severity === 'low') {
        map[v.filePath][v.severity]++;
      }
    }
    return Object.entries(map)
      .map(([file, counts]) => ({ file: file.split('/').pop() ?? file, ...counts }))
      .sort((a, b) => (b.critical * 8 + b.high * 4 + b.medium * 2 + b.low) -
                      (a.critical * 8 + a.high * 4 + a.medium * 2 + a.low))
      .slice(0, 10);
  }, [vulns]);

  const heatmapCells = isApiLive ? apiData.fileHeatmap : localHeatmap;

  // ── OWASP 바 차트 (로컬 store 기반) ──────────────────────────
  const owaspRows = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const v of vulns) {
      if (v.owaspCategory) {
        counts[v.owaspCategory] = (counts[v.owaspCategory] ?? 0) + 1;
      }
    }
    const maxCount = Math.max(1, ...Object.values(counts));
    const palette = ['var(--critical)', 'var(--high)', 'var(--medium)', 'var(--orange)', 'var(--tag-6)'];
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, count], i) => ({
        label: label.length > 18 ? label.slice(0, 16) + '…' : label,
        count,
        maxCount,
        color: palette[i % palette.length],
      }));
  }, [vulns]);

  // ── 트렌드 차트 — API 우선, 없으면 현재 점수 단일 포인트 ────
  const trendData = isApiLive && apiData.trend.length > 0
    ? apiData.trend
    : [{ date: '현재', score: securityScore }];

  // ── OWASP 커버리지 매트릭스 ──────────────────────────────────
  const owaspCells = isApiLive ? apiData.owaspCells : undefined;

  const hasVulns = totalVulns > 0;

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-0)', display: 'flex', flexDirection: 'column' }}>

      {/* ── 대시보드 탑바 ── */}
      <div style={{
        height: 48, flexShrink: 0,
        background: 'var(--bg-1)',
        borderBottom: '1px solid var(--hairline)',
        display: 'flex', alignItems: 'center', padding: '0 24px', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Security Dashboard</span>
          {hasVulns && (
            <span className="chip chip-critical" style={{ height: 18, fontSize: 9 }}>
              {totalVulns}
            </span>
          )}
        </div>

        <ApiStatusChip
          isLoading={isLoading}
          isLive={isApiLive}
          error={error}
          onRefetch={refetch}
        />

        <div style={{ flex: 1 }} />

        <DateRangeBar value={dateRange} onChange={setDateRange} />
        <ViewToggle value={dashView} onChange={setDashView} />

        <button
          onClick={() => setShowPdfModal(true)}
          style={{
            height: 28, padding: '0 12px', borderRadius: 6,
            background: 'var(--bg-3)', border: '1px solid var(--border)',
            color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <FileText size={12} /> PDF 리포트
        </button>
      </div>

      {showPdfModal && <PdfReportModal onClose={() => setShowPdfModal(false)} />}

      <div
        className="pb-mobile-nav"
        style={{
          padding: '20px 16px', maxWidth: 1280,
          margin: '0 auto', width: '100%',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}
      >
        {/* ── 헤더 ── */}
        <div style={{ borderBottom: '1px solid var(--hairline)', paddingBottom: 16 }}>
          <h1 style={{
            fontSize: 22, fontWeight: 700, color: 'var(--text-primary)',
            letterSpacing: '-0.02em', marginBottom: 4,
          }}>
            Security Audit Dashboard
          </h1>
          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
            {hasVulns
              ? `취약점 ${totalVulns}개 감지됨 · 보안 점수 ${securityScore}${isApiLive ? ' · 백엔드 집계' : ' · 로컬 분석'}`
              : '분석 결과가 없습니다 — 폴더를 열고 분석을 시작하세요'}
          </p>
        </div>

        {/* ── KPI 카드 ── */}
        <div className="kpi-grid dashboard-kpi-grid" aria-label="주요 보안 지표">
          <KpiCard value={securityScore} label="보안 점수"  color={scoreColor} isScore />
          <KpiCard value={critical}      label="Critical"   color="var(--critical)" />
          <KpiCard value={high}          label="High"       color="var(--high)" />
          <KpiCard value={medium}        label="Medium"     color="var(--medium)" />
          <KpiCard
            value={totalVulns > 0 ? `${Math.round((patched / localTotal) * 100)}%` : '—'}
            label="패치 완료율"
            color="var(--low)"
          />
        </div>

        {/* ── 추가 정보 카드 행 (크레딧 · 컴플라이언스 · 도메인 모니터링) ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>

          {/* 크레딧 현황 카드 — 실제 balance */}
          <div style={{
            background: 'var(--bg-2)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '16px 20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>크레딧 잔액</span>
              <CreditCard size={14} color={DASH_COLORS.credits} aria-hidden="true" />
            </div>
            {creditsLoading ? (
              <div style={{ fontSize: 12, color: 'var(--text-disabled)', fontFamily: 'var(--font-mono)' }}>불러오는 중...</div>
            ) : creditsData ? (
              <>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
                  <span style={{ fontSize: 28, fontWeight: 700, color: DASH_COLORS.credits, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>
                    {creditsData.balance.toLocaleString()}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>크레딧</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    fontSize: 9, padding: '1px 6px', borderRadius: 3,
                    background: 'rgba(249,115,22,0.12)', color: DASH_COLORS.credits,
                    fontFamily: 'var(--font-mono)', fontWeight: 700,
                  }}>
                    {creditsData.plan.displayName || creditsData.plan.name}
                  </span>
                  {creditsData.hasByok && (
                    <span style={{
                      fontSize: 9, padding: '1px 6px', borderRadius: 3,
                      background: 'rgba(129,140,248,0.12)', color: DASH_COLORS.sbom,
                      fontFamily: 'var(--font-mono)', fontWeight: 700,
                    }}>
                      BYOK
                    </span>
                  )}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--text-disabled)', fontFamily: 'var(--font-mono)' }}>데이터 없음</div>
            )}
          </div>

          {/* 컴플라이언스 카드 — nav 카드 (요약 API 없음, projectId 게이트) */}
          <button
            onClick={() => { if (projectId) router.push(`/projects/${projectId}/compliance`); }}
            disabled={!projectId}
            aria-disabled={!projectId}
            title={projectId ? '컴플라이언스 페이지로 이동' : '프로젝트를 선택하면 활성화됩니다'}
            style={{
              background: 'var(--bg-2)', border: `1px solid ${projectId ? 'rgba(86,156,214,0.3)' : 'var(--border)'}`,
              borderRadius: 8, padding: '16px 20px', cursor: projectId ? 'pointer' : 'default',
              opacity: projectId ? 1 : 0.5, textAlign: 'left',
              transition: 'border-color 0.15s, background 0.15s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>컴플라이언스</span>
              <ClipboardList size={14} color={projectId ? DASH_COLORS.compliance : DASH_COLORS.disabled} aria-hidden="true" />
            </div>
            <div style={{ fontSize: 13, color: projectId ? DASH_COLORS.compliance : 'var(--text-disabled)', fontWeight: 600, marginBottom: 4 }}>
              {projectId ? '규정 준수 현황 보기' : '프로젝트 선택 필요'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-tertiary)' }}>
              {projectId
                ? <><span>OWASP · ISMS-P · 행안부</span><ChevronRight size={11} /></>
                : <><AlertCircle size={11} /><span>사이드바에서 프로젝트를 선택하세요</span></>}
            </div>
          </button>

          {/* 도메인 모니터링 카드 — 비활성 (FE 없음, 데이터 없음) */}
          <div
            aria-disabled="true"
            style={{
              background: 'var(--bg-2)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '16px 20px', opacity: 0.45,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>도메인 모니터링</span>
              <Activity size={14} color={DASH_COLORS.disabled} aria-hidden="true" />
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-disabled)', fontWeight: 600, marginBottom: 4 }}>준비 중</div>
            <div style={{
              display: 'inline-flex', alignItems: 'center',
              fontSize: 9, padding: '1px 6px', borderRadius: 3,
              background: 'rgba(167,139,250,0.08)', color: DASH_COLORS.monitoring,
              fontFamily: 'var(--font-mono)', fontWeight: 700,
            }}>
              COMING SOON
            </div>
          </div>
        </div>

        {/* ── 자동화 빠른액션 4-grid ── */}
        <div style={{
          background: 'var(--bg-2)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '16px 20px',
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>
            자동화 빠른 액션
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>

            {/* 시크릿 스캔 — /commit-scan 연결 */}
            <button
              onClick={() => router.push('/commit-scan')}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6,
                padding: '12px 14px', borderRadius: 7,
                background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.2)',
                cursor: 'pointer', textAlign: 'left', transition: 'background 0.12s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(52,211,153,0.12)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(52,211,153,0.06)'; }}
            >
              <Key size={16} color={DASH_COLORS.secretScan} aria-hidden="true" />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>시크릿 스캔</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>커밋·코드 내 시크릿</div>
              </div>
            </button>

            {/* SBOM & CVE — projectId 있으면 페이지, 없으면 에디터 내 탭 */}
            <button
              onClick={() => {
                if (projectId) router.push(`/projects/${projectId}/sbom`);
              }}
              disabled={!projectId}
              aria-disabled={!projectId}
              aria-label={projectId ? 'SBOM & CVE 페이지로 이동' : 'SBOM & CVE — 프로젝트 선택 필요'}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6,
                padding: '12px 14px', borderRadius: 7,
                background: 'rgba(129,140,248,0.06)', border: '1px solid rgba(129,140,248,0.2)',
                cursor: projectId ? 'pointer' : 'default', opacity: projectId ? 1 : 0.5,
                textAlign: 'left', transition: 'background 0.12s',
              }}
              onMouseEnter={(e) => { if (projectId) (e.currentTarget as HTMLElement).style.background = 'rgba(129,140,248,0.12)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(129,140,248,0.06)'; }}
            >
              <Package size={16} color={DASH_COLORS.sbom} aria-hidden="true" />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>SBOM & CVE</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
                  {projectId ? '컴포넌트 의존성 분석' : '프로젝트 선택 필요'}
                </div>
              </div>
            </button>

            {/* PR 자동 리뷰 — 비활성 */}
            <div
              aria-disabled="true"
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6,
                padding: '12px 14px', borderRadius: 7,
                background: 'rgba(167,139,250,0.04)', border: '1px solid rgba(167,139,250,0.12)',
                opacity: 0.45, cursor: 'default',
              }}
            >
              <Github size={16} color={DASH_COLORS.monitoring} aria-hidden="true" />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>PR 자동 리뷰</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>준비 중</div>
              </div>
            </div>

            {/* 예약 스캔 — 비활성 */}
            <div
              aria-disabled="true"
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6,
                padding: '12px 14px', borderRadius: 7,
                background: 'rgba(167,139,250,0.04)', border: '1px solid rgba(167,139,250,0.12)',
                opacity: 0.45, cursor: 'default',
              }}
            >
              <Clock3 size={16} color={DASH_COLORS.monitoring} aria-hidden="true" />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>예약 자동 스캔</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>준비 중</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── 차트 2열 ── */}
        <div className="chart-grid dashboard-chart-grid">
          <Card title="OWASP 분류별 취약점">
            {owaspRows.length > 0
              ? <SeverityBarChart rows={owaspRows} />
              : <InlineEmpty label="분석 후 OWASP 분포가 표시됩니다" />}
          </Card>
          <Card title={isApiLive ? '일별 취약점 발생 추이 (7일)' : '보안 점수 트렌드'}>
            {hasVulns || (isApiLive && trendData.length > 0)
              ? <TrendLineChart data={trendData} height={80} />
              : <InlineEmpty label="분석 이력이 쌓이면 트렌드가 표시됩니다" />}
          </Card>
        </div>

        {/* ── Analyst 뷰 전용 ── */}
        {dashView === 'analyst' && (
          <>
            <Card title="파일별 취약점 히트맵">
              {heatmapCells.length > 0
                ? <FileHeatmap cells={heatmapCells} />
                : <InlineEmpty label="분석 후 파일별 분포가 표시됩니다" />}
            </Card>

            <Card title="OWASP Top 10 커버리지 (A01 ~ A10)">
              <OwaspCoverageMatrix cells={owaspCells} />
            </Card>
          </>
        )}

        {/* ── 토큰 사용량 ── */}
        {lastTokenUsage && (
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>토큰 사용량</span>
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 3,
                  background: 'rgba(99,102,241,0.12)', color: 'var(--tag-1)',
                  border: '0.5px solid rgba(99,102,241,0.25)',
                }}>
                  {lastTokenUsage.modelId}
                </span>
              </div>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                ${lastTokenUsage.estimatedCostUsd.toFixed(4)}
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 6 }}>
                  (≈ ₩{Math.round(lastTokenUsage.estimatedCostUsd * 1380).toLocaleString()})
                </span>
              </span>
            </div>
            <div style={{
              marginTop: 12, display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
            }}>
              {([
                { label: '입력',      value: lastTokenUsage.inputTokens,      color: 'var(--tag-5)' },
                { label: '출력',      value: lastTokenUsage.outputTokens,     color: 'var(--tag-3)' },
                { label: '캐시 쓰기', value: lastTokenUsage.cacheWriteTokens, color: 'var(--high)' },
                { label: '캐시 읽기', value: lastTokenUsage.cacheReadTokens,  color: 'var(--tag-6)' },
              ] as const).map(({ label, value, color }) => (
                <div key={label} style={{
                  background: 'var(--bg-1)', borderRadius: 6, padding: '8px 12px',
                  border: '1px solid var(--border)',
                }}>
                  <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>
                    {value.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--text-disabled)', marginTop: 2 }}>tokens</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 8, fontSize: 10, color: 'var(--text-disabled)' }}>
              총 {(lastTokenUsage.inputTokens + lastTokenUsage.outputTokens + lastTokenUsage.cacheWriteTokens + lastTokenUsage.cacheReadTokens).toLocaleString()} 토큰
              · 가격 기준: 입력 $0.80 / 출력 $4.00 / 캐시쓰기 $1.00 / 캐시읽기 $0.08 (per MTok)
            </div>
          </Card>
        )}

        {/* ── 취약점 없을 때 첫 프로젝트 안내 ── */}
        {!hasVulns && !isLoading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
            <EmptyState
              variant="first-project"
              eyebrow="첫 진입"
              title="프로젝트를 분석해 보세요"
              description="사이드바에서 폴더를 열고 분석 시작 버튼을 누르면 취약점이 이 대시보드에 표시됩니다."
              maxWidth={360}
            />
          </div>
        )}

        {/* ── 취약점 상세 목록 ── */}
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid var(--hairline)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>취약점 상세 목록</span>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{filteredVulns.length}개 표시 중</span>
          </div>
          <FilterBar />
          <VulnDetailPanel />
        </div>
      </div>
    </div>
  );
}
