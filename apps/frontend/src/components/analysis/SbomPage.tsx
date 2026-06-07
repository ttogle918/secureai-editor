'use client';
// components/analysis/SbomPage.tsx
// SBOM & CVE 결과 화면 — GET /api/v1/projects/{projectId}/sbom/components?sessionId= API 연결.
// API 미응답(프로젝트/세션 미선택, 오류) 시 mock 데이터로 fallback.

import { useState, useEffect, useCallback } from 'react';
import {
  Package, Download, RefreshCw, Search,
  ChevronRight, Zap, ExternalLink, Copy, Code, ArrowLeft,
} from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { apiClient } from '@/lib/api/client';
import { useSecureStore } from '@/store/useSecureStore';

// ─── Types ──────────────────────────────────────────────────────────────────

type Severity = 'critical' | 'high' | 'medium' | 'low';

interface CveEntry {
  id: string;
  severity: Severity;
  cvss: number;
  summary: string;
  fixed: string;
}

interface Dependency {
  name: string;
  version: string;
  latest: string;
  ecosystem: 'npm' | 'maven' | 'pip' | 'cargo';
  cves: CveEntry[];
  license: string;
  direct: boolean;
}

// 백엔드 GET /api/v1/projects/{projectId}/sbom/components 응답 타입
interface SbomComponentResponse {
  id: string;
  name: string;
  version: string | null;
  ecosystem: string;
  license: string | null;
  cveIds: string[];
  isDirect: boolean;
}

// ─── Mock data (API 미응답 시 fallback) ──────────────────────────────────────

const MOCK_DEPS: Dependency[] = [
  { name: 'next',          version: '15.0.3',  latest: '15.0.5',   ecosystem: 'npm',  cves: [], license: 'MIT',        direct: true },
  { name: 'next-auth',     version: '4.22.1',  latest: '4.24.10',  ecosystem: 'npm',  cves: [
    { id: 'CVE-2024-22020', severity: 'high',     cvss: 7.5, summary: '서버 사이드 요청 위조로 인한 정보 노출', fixed: '4.24.5' },
  ], license: 'ISC', direct: true },
  { name: 'axios',         version: '1.6.2',   latest: '1.7.7',    ecosystem: 'npm',  cves: [
    { id: 'CVE-2023-45857', severity: 'medium',   cvss: 6.5, summary: 'CSRF 토큰 헤더 노출', fixed: '1.6.4' },
  ], license: 'MIT', direct: true },
  { name: 'jsonwebtoken',  version: '9.0.0',   latest: '9.0.2',    ecosystem: 'npm',  cves: [
    { id: 'CVE-2022-23529', severity: 'critical', cvss: 9.8, summary: 'JWT 검증 우회 취약점', fixed: '9.0.0' },
    { id: 'CVE-2022-23541', severity: 'high',     cvss: 7.6, summary: '알고리즘 혼동 공격',  fixed: '9.0.0' },
  ], license: 'MIT', direct: true },
  { name: 'lodash',        version: '4.17.20', latest: '4.17.21',  ecosystem: 'npm',  cves: [
    { id: 'CVE-2021-23337', severity: 'high',     cvss: 7.2, summary: '명령어 인젝션 (template)', fixed: '4.17.21' },
  ], license: 'MIT', direct: false },
  { name: 'react',         version: '18.3.1',  latest: '18.3.1',   ecosystem: 'npm',  cves: [], license: 'MIT',        direct: true },
  { name: 'prisma',        version: '5.22.0',  latest: '6.0.1',    ecosystem: 'npm',  cves: [], license: 'Apache-2.0', direct: true },
  { name: 'zod',           version: '3.22.4',  latest: '3.23.8',   ecosystem: 'npm',  cves: [], license: 'MIT',        direct: false },
  { name: 'pg',            version: '8.11.3',  latest: '8.13.1',   ecosystem: 'npm',  cves: [], license: 'MIT',        direct: false },
  { name: 'recharts',      version: '2.10.4',  latest: '2.13.3',   ecosystem: 'npm',  cves: [], license: 'MIT',        direct: false },
];

// ─── API 응답 → Dependency 변환 헬퍼 ────────────────────────────────────────

function toEcosystem(raw: string): Dependency['ecosystem'] {
  if (raw === 'npm' || raw === 'maven' || raw === 'pip' || raw === 'cargo') return raw;
  return 'npm';
}

function mapApiResponse(item: SbomComponentResponse): Dependency {
  return {
    name:      item.name,
    version:   item.version ?? '—',
    latest:    item.version ?? '—',  // 현재 API는 latest 버전 정보 미제공 — 동일값으로 설정
    ecosystem: toEcosystem(item.ecosystem),
    cves:      item.cveIds.map((id) => ({
      id,
      severity: 'high' as Severity,   // API가 severity 미제공 — 추후 CVE 도메인 연동 시 대체
      cvss:     0,
      summary:  '',
      fixed:    '—',
    })),
    license: item.license ?? '—',
    direct:  item.isDirect,
  };
}

// ─── Severity helpers ────────────────────────────────────────────────────────

const SEV_COLOR: Record<Severity, string> = {
  critical: 'var(--critical)',
  high:     'var(--high)',
  medium:   'var(--medium)',
  low:      'var(--low)',
};

const SEV_DIM: Record<Severity, string> = {
  critical: 'var(--critical-dim)',
  high:     'var(--high-dim)',
  medium:   'var(--medium-dim)',
  low:      'var(--low-dim)',
};

const SEV_BORDER: Record<Severity, string> = {
  critical: 'rgba(240,65,65,0.4)',
  high:     'rgba(245,158,11,0.4)',
  medium:   'rgba(234,179,8,0.4)',
  low:      'rgba(34,197,94,0.4)',
};

const SEV_ORDER: Record<Severity, number> = { critical: 3, high: 2, medium: 1, low: 0 };

function worstSeverity(cves: CveEntry[]): Severity {
  return cves.reduce<Severity>((acc, c) =>
    SEV_ORDER[c.severity] > SEV_ORDER[acc] ? c.severity : acc
  , 'low');
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SeverityChip({ sev, label }: { sev: Severity; label?: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      height: 20, padding: '0 8px', borderRadius: 3,
      background: SEV_DIM[sev], border: `1px solid ${SEV_BORDER[sev]}`,
      color: SEV_COLOR[sev], fontSize: 10, fontWeight: 700,
      fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: SEV_COLOR[sev], flexShrink: 0 }} />
      {label ?? sev.toUpperCase()}
    </span>
  );
}

function KpiStat({ label, value, color = 'var(--text-primary)', sub, divider }: {
  label: string; value: number; color?: string; sub?: string; divider?: boolean;
}) {
  return (
    <>
      <div style={{ flex: 1, padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 'fit-content' }}>
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 500, letterSpacing: '0.02em', whiteSpace: 'nowrap', wordBreak: 'keep-all' }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1, fontFamily: 'var(--font-mono)' }}>{value}</span>
          {sub && <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{sub}</span>}
        </div>
      </div>
      {divider && <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--hairline)', margin: '12px 0' }} />}
    </>
  );
}

// ─── Filter row ──────────────────────────────────────────────────────────────

type FilterItem = { label: string; count: number; active: boolean; tone?: string };

function FilterRow({ label, items, onToggle }: {
  label: string;
  items: FilterItem[];
  onToggle: (label: string) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ width: 78, fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em', flexShrink: 0, whiteSpace: 'nowrap', wordBreak: 'keep-all' }}>
        {label}
      </span>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {items.map((it) => {
          const sev = it.tone as Severity | undefined;
          const activeBg = sev ? SEV_DIM[sev] : it.active ? 'var(--bg-2)' : 'var(--bg-3)';
          const activeBorder = sev ? SEV_BORDER[sev] : it.active ? 'var(--border-3)' : 'var(--border-2)';
          const activeColor = sev ? SEV_COLOR[sev] : it.active ? 'var(--text-active)' : 'var(--text-secondary)';
          return (
            <button
              key={it.label}
              onClick={() => onToggle(it.label)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                height: 20, padding: '0 8px', borderRadius: 3,
                background: it.active ? activeBg : 'var(--bg-3)',
                border: `1px solid ${it.active ? activeBorder : 'var(--border-2)'}`,
                color: it.active ? activeColor : 'var(--text-secondary)',
                fontSize: 10, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', whiteSpace: 'nowrap',
                opacity: it.count === 0 ? 0.4 : 1,
              }}
            >
              {it.label}
              <span style={{ opacity: 0.7 }}>{it.count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── CVE Detail card ─────────────────────────────────────────────────────────

function CveDetailCard({ dep, cve }: { dep: Dependency; cve: CveEntry }) {
  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      {/* Card header */}
      <div style={{
        padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 12,
        background: 'var(--bg-3)', borderBottom: '1px solid var(--hairline)',
      }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: SEV_COLOR[cve.severity], fontFamily: 'var(--font-mono)' }}>{cve.id}</span>
        <SeverityChip sev={cve.severity} label={`${cve.severity.toUpperCase()} · CVSS ${cve.cvss}`} />
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          height: 20, padding: '0 8px', borderRadius: 3,
          background: 'var(--orange-dim)', color: 'var(--orange)',
          border: '1px solid rgba(249,115,22,0.4)', fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)',
        }}>자동 패치 가능</span>
        <div style={{ flex: 1 }} />
        <button
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 6, background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}
          title="NVD에서 보기"
        >
          <ExternalLink size={11} />NVD
        </button>
        <button
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 6, background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}
          title="링크 복사"
        >
          <Copy size={11} />링크 복사
        </button>
      </div>

      {/* Card body */}
      <div style={{ padding: '22px', display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 32 }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.08em', marginBottom: 8, fontFamily: 'var(--font-mono)' }}>설명</div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: 20 }}>
            {cve.summary}
          </p>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.08em', marginBottom: 10, fontFamily: 'var(--font-mono)' }}>패키지</div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '7px 10px', background: 'var(--bg-3)', borderRadius: 6,
            fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)',
          }}>
            <Code size={12} color="var(--orange)" />
            <span>{dep.name}@{dep.version}</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.08em', marginBottom: 10, fontFamily: 'var(--font-mono)' }}>패치</div>
          <div style={{ padding: 14, background: 'var(--bg-0)', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: 12, marginBottom: 14, lineHeight: 1.6 }}>
            <div style={{ color: 'var(--critical)' }}>- &quot;{dep.name}&quot;: &quot;{dep.version}&quot;</div>
            <div style={{ color: 'var(--low)' }}>+ &quot;{dep.name}&quot;: &quot;{cve.fixed}&quot;</div>
          </div>
          {/* API: POST /api/v1/projects/{projectId}/sbom/patch-pr — { cveId, componentName, targetVersion } → GitHub PR 생성 */}
          <button style={{
            width: '100%', height: 36, fontSize: 13, fontWeight: 700,
            background: 'var(--orange-2)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <Zap size={12} />패치 적용 · PR 생성
          </button>
          <button style={{
            width: '100%', height: 32, marginTop: 6, fontSize: 13,
            background: 'none', color: 'var(--text-tertiary)', border: 'none', cursor: 'pointer',
          }}>
            나중에 처리
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

type SeverityFilterKey = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
type DepTypeFilter = '전체' | '직접' | '전이' | '패치 가능' | '업데이트 필요';
type EcoFilter = 'npm' | 'maven' | 'pip' | 'cargo';

interface FilterState {
  severities: Record<SeverityFilterKey, boolean>;
  depType: DepTypeFilter;
  ecosystem: EcoFilter;
  query: string;
}

export function SbomPage({ projectName = 'shop-api' }: { projectName?: string }) {
  const projectId        = useSecureStore((s) => s.projectId);
  const lockedSessionId  = useSecureStore((s) => s.lockedSessionId);

  const [deps, setDeps]         = useState<Dependency[]>(MOCK_DEPS);
  const [apiLoading, setApiLoading] = useState(false);
  const [usingMock, setUsingMock]   = useState(true);

  const [cdxDownloading, setCdxDownloading] = useState(false);
  const [cdxError, setCdxError]             = useState<string | null>(null);

  useEffect(() => {
    if (!projectId || !lockedSessionId) {
      setDeps(MOCK_DEPS);
      setUsingMock(true);
      return;
    }

    setApiLoading(true);
    const params = new URLSearchParams({ sessionId: lockedSessionId });
    apiClient
      .get<{ data: SbomComponentResponse[] }>(
        `/projects/${projectId}/sbom/components?${params}`,
      )
      .then((res) => {
        const items = res.data ?? [];
        if (items.length > 0) {
          setDeps(items.map(mapApiResponse));
          setUsingMock(false);
        } else {
          setDeps([]);
          setUsingMock(false);
        }
      })
      .catch(() => {
        // API 실패 시 mock 데이터 유지
        setDeps(MOCK_DEPS);
        setUsingMock(true);
      })
      .finally(() => setApiLoading(false));
  }, [projectId, lockedSessionId]);
  /**
   * CycloneDX 1.4 JSON을 GET /api/v1/projects/{projectId}/sbom/cyclonedx 로 요청하고
   * 브라우저 다운로드를 트리거한다.
   * JWT는 apiClient가 메모리의 accessToken을 자동으로 Authorization 헤더에 추가한다.
   */
  const handleCycloneDxDownload = useCallback(async () => {
    if (!projectId || !lockedSessionId) {
      setCdxError('프로젝트 또는 세션이 선택되지 않았습니다.');
      return;
    }

    setCdxDownloading(true);
    setCdxError(null);

    try {
      const params = new URLSearchParams({ sessionId: lockedSessionId });
      const response = await apiClient.get<{ data: unknown }>(
        `/projects/${projectId}/sbom/cyclonedx?${params}`,
      );

      const json = JSON.stringify(response.data ?? response, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);

      const anchor  = document.createElement('a');
      anchor.href   = url;
      anchor.download = 'sbom.cdx.json';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch {
      setCdxError('CycloneDX 내보내기에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setCdxDownloading(false);
    }
  }, [projectId, lockedSessionId]);

  const [selectedCve, setSelectedCve] = useState<{ dep: Dependency; cve: CveEntry } | null>(null);
  const [sortOrder, setSortOrder] = useState<'name' | 'severity'>('severity');

  const [filters, setFilters] = useState<FilterState>({
    severities: { CRITICAL: true, HIGH: true, MEDIUM: true, LOW: false },
    depType: '전체',
    ecosystem: 'npm',
    query: '',
  });

  // Derived stats
  const totalDeps    = deps.length;
  const vulnDeps     = deps.filter((d) => d.cves.length > 0).length;
  const totalCves    = deps.reduce((acc, d) => acc + d.cves.length, 0);
  const criticalCves = deps.flatMap((d) => d.cves).filter((c) => c.severity === 'critical').length;
  const outdated     = deps.filter((d) => d.version !== d.latest).length;

  // Filter + sort
  const filteredDeps = deps
    .filter((d) => {
      if (filters.query && !d.name.toLowerCase().includes(filters.query.toLowerCase()) &&
          !d.cves.some((c) => c.id.toLowerCase().includes(filters.query.toLowerCase()))) {
        return false;
      }
      if (filters.depType === '직접' && !d.direct) return false;
      if (filters.depType === '전이' && d.direct) return false;
      if (filters.depType === '패치 가능' && d.cves.length === 0) return false;
      if (filters.depType === '업데이트 필요' && d.version === d.latest) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortOrder === 'name') return a.name.localeCompare(b.name);
      const aW = a.cves.length > 0 ? SEV_ORDER[worstSeverity(a.cves)] : -1;
      const bW = b.cves.length > 0 ? SEV_ORDER[worstSeverity(b.cves)] : -1;
      return bW - aW;
    });

  const toggleSeverity = (sev: SeverityFilterKey) =>
    setFilters((f) => ({ ...f, severities: { ...f.severities, [sev]: !f.severities[sev] } }));

  const sevItems: Array<FilterItem & { label: SeverityFilterKey }> = [
    { label: 'CRITICAL', count: criticalCves, active: filters.severities.CRITICAL, tone: 'critical' },
    { label: 'HIGH',     count: deps.flatMap((d) => d.cves).filter((c) => c.severity === 'high').length,   active: filters.severities.HIGH,   tone: 'high' },
    { label: 'MEDIUM',   count: deps.flatMap((d) => d.cves).filter((c) => c.severity === 'medium').length, active: filters.severities.MEDIUM, tone: 'medium' },
    { label: 'LOW',      count: deps.flatMap((d) => d.cves).filter((c) => c.severity === 'low').length,    active: filters.severities.LOW,    tone: 'low' },
  ];

  // Auto-select first CVE of first vuln dep on initial load
  useEffect(() => {
    const firstVuln = deps.find((d) => d.cves.length > 0);
    if (firstVuln) {
      setSelectedCve({ dep: firstVuln, cve: firstVuln.cves[0] });
    }
  }, [deps]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-0)' }}>
      {/* Header */}
      <div style={{
        height: 56, flexShrink: 0,
        background: 'var(--bg-1)', borderBottom: '1px solid var(--hairline)',
        display: 'flex', alignItems: 'center', padding: '0 24px', gap: 14,
      }}>
        <button
          onClick={() => history.back()}
          title="뒤로 가기"
          style={{
            width: 32, height: 32, borderRadius: 7, border: '1px solid var(--border)',
            background: 'var(--bg-2)', color: 'var(--text-secondary)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <ArrowLeft size={13} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--tag-1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Package size={13} color="#fff" />
          </div>
          <span style={{ fontSize: 13, fontWeight: 700 }}>SBOM &amp; CVE</span>
          <ChevronRight size={11} color="var(--text-tertiary)" />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{projectName}</span>
          {apiLoading && (
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
              로딩 중...
            </span>
          )}
          {!apiLoading && usingMock && (
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.04em',
              color: 'var(--orange)', fontFamily: 'var(--font-mono)',
              padding: '2px 6px', borderRadius: 3,
              background: 'var(--orange-dim)', border: '1px solid rgba(249,115,22,0.3)',
            }}>
              MOCK
            </span>
          )}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
          {/* API: GET /api/v1/projects/{projectId}/sbom/cyclonedx?sessionId={sessionId} — CycloneDX 1.4 JSON */}
          <button
            onClick={handleCycloneDxDownload}
            disabled={cdxDownloading || !projectId || !lockedSessionId}
            title={!projectId || !lockedSessionId ? '프로젝트와 세션을 먼저 선택하세요' : 'CycloneDX 1.4 JSON 다운로드'}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', borderRadius: 6,
              background: 'var(--bg-3)', border: '1px solid var(--border)',
              color: cdxDownloading ? 'var(--text-tertiary)' : 'var(--text-secondary)',
              fontSize: 12, cursor: (cdxDownloading || !projectId || !lockedSessionId) ? 'not-allowed' : 'pointer',
              fontWeight: 600, opacity: (!projectId || !lockedSessionId) ? 0.5 : 1,
            }}
          >
            <Download size={11} />
            {cdxDownloading ? '다운로드 중...' : 'SBOM 내보내기 (CycloneDX)'}
          </button>
          {cdxError && (
            <span style={{ fontSize: 10, color: 'var(--critical)', fontFamily: 'var(--font-mono)' }}>
              {cdxError}
            </span>
          )}
        </div>
        {/* API: POST /api/v1/projects/{projectId}/sbom/rescan — 새 스캔 세션 트리거 */}
        <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 6, background: 'var(--orange-2)', color: '#fff', border: 'none', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>
          <RefreshCw size={11} />재스캔
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ padding: '28px 28px 48px', maxWidth: 1280, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 28 }}>

          {/* KPI strip */}
          <div className="hide-scrollbar" style={{ display: 'flex', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, overflowX: 'auto' }}>
            <KpiStat label="총 의존성"      value={totalDeps}    divider />
            <KpiStat label="취약한 의존성"  value={vulnDeps}     color="var(--critical)" sub={`(${Math.round(vulnDeps / totalDeps * 100)}%)`} divider />
            <KpiStat label="전체 CVE"        value={totalCves}    color="var(--high)"     divider />
            <KpiStat label="CRITICAL"        value={criticalCves} color="var(--critical)" divider />
            <KpiStat label="업데이트 가능"   value={outdated}     color="var(--orange)"   />
          </div>

          {/* Filter section */}
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
              <div style={{ flexShrink: 0, whiteSpace: 'nowrap', wordBreak: 'keep-all' }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em' }}>의존성 필터</h3>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>심각도 · 의존성 종류 · 생태계로 좁히기</div>
              </div>
              <div style={{ flex: 1 }} />
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px',
                height: 30, background: 'var(--bg-2)', border: '1px solid var(--border)',
                borderRadius: 7, minWidth: 280,
              }}>
                <Search size={12} color="var(--text-tertiary)" />
                <input
                  value={filters.query}
                  onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
                  placeholder="패키지명 또는 CVE ID…"
                  style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 12, color: 'var(--text-primary)' }}
                />
              </div>
            </div>

            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <FilterRow
                label="심각도"
                items={sevItems}
                onToggle={(lbl) => toggleSeverity(lbl as SeverityFilterKey)}
              />
              <div style={{ height: 1, background: 'var(--hairline)' }} />
              <FilterRow
                label="의존성"
                items={([
                  { label: '전체',        count: totalDeps,                                       active: filters.depType === '전체' },
                  { label: '직접',        count: deps.filter((d) => d.direct).length,              active: filters.depType === '직접' },
                  { label: '전이',        count: deps.filter((d) => !d.direct).length,             active: filters.depType === '전이' },
                  { label: '패치 가능',   count: vulnDeps,                                         active: filters.depType === '패치 가능', tone: 'orange' },
                  { label: '업데이트 필요', count: outdated,                                       active: filters.depType === '업데이트 필요' },
                ] as FilterItem[])}
                onToggle={(lbl) => setFilters((f) => ({ ...f, depType: lbl as DepTypeFilter }))}
              />
              <div style={{ height: 1, background: 'var(--hairline)' }} />
              <FilterRow
                label="생태계"
                items={([
                  { label: 'npm',   count: deps.filter((d) => d.ecosystem === 'npm').length,   active: filters.ecosystem === 'npm' },
                  { label: 'pip',   count: 0, active: false },
                  { label: 'maven', count: 0, active: false },
                  { label: 'cargo', count: 0, active: false },
                ] as FilterItem[])}
                onToggle={(lbl) => setFilters((f) => ({ ...f, ecosystem: lbl as EcoFilter }))}
              />
            </div>
          </div>

          {/* Table section */}
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
              <div style={{ flexShrink: 0, whiteSpace: 'nowrap', wordBreak: 'keep-all' }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em' }}>의존성 목록</h3>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>{totalDeps}개 의존성 · {vulnDeps}개 취약</div>
              </div>
              <div style={{ flex: 1 }} />
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => setSortOrder('name')}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: sortOrder === 'name' ? 'var(--bg-3)' : 'transparent', color: sortOrder === 'name' ? 'var(--text-primary)' : 'var(--text-tertiary)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                >
                  이름순
                </button>
                <button
                  onClick={() => setSortOrder('severity')}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: sortOrder === 'severity' ? 'var(--bg-3)' : 'transparent', color: sortOrder === 'severity' ? 'var(--orange)' : 'var(--text-tertiary)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                >
                  위험도순 ↓
                </button>
              </div>
            </div>

            <div className="hide-scrollbar" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, overflowX: 'auto' }}>
              <div style={{ minWidth: 650 }}>
              {/* Table header */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1.6fr 0.9fr 0.9fr 1.6fr 1.1fr 1fr 0.6fr',
                gap: 16, padding: '12px 22px',
                fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)',
                background: 'var(--bg-3)', borderBottom: '1px solid var(--hairline)',
              }}>
                <span>패키지</span>
                <span style={{ whiteSpace: 'nowrap' }}>현재</span>
                <span style={{ whiteSpace: 'nowrap' }}>최신</span>
                <span>CVE</span>
                <span style={{ whiteSpace: 'nowrap' }}>심각도</span>
                <span style={{ whiteSpace: 'nowrap' }}>수정 버전</span>
                <span style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>액션</span>
              </div>

              {/* 필터 결과 없음 */}
              {filteredDeps.length === 0 && (
                <div style={{ padding: '32px 16px' }}>
                  <EmptyState
                    variant="filter-empty"
                    eyebrow="필터 결과"
                    title="일치하는 의존성 없음"
                    description="검색어나 필터 조건을 변경해 보세요."
                    maxWidth={300}
                  />
                </div>
              )}

              {/* Rows */}
              {filteredDeps.map((d, di) => {
                const hasCves   = d.cves.length > 0;
                const isOutdated = d.version !== d.latest;
                const worst      = hasCves ? worstSeverity(d.cves) : null;
                return (
                  <div
                    key={d.name}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1.6fr 0.9fr 0.9fr 1.6fr 1.1fr 1fr 0.6fr',
                      gap: 16, padding: '14px 22px',
                      alignItems: 'center', fontSize: 12,
                      borderBottom: di === filteredDeps.length - 1 ? 'none' : '1px solid var(--hairline)',
                      cursor: hasCves ? 'pointer' : 'default',
                    }}
                    onClick={() => {
                      if (hasCves) setSelectedCve({ dep: d, cve: d.cves[0] });
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Package size={13} color={d.direct ? 'var(--orange)' : 'var(--text-tertiary)'} />
                      <div>
                        <div style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{d.name}</div>
                        <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 2 }}>
                          {d.direct ? '직접 의존' : '전이 의존'} · {d.license}
                        </div>
                      </div>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{d.version}</span>
                    <span style={{ fontSize: 11, color: isOutdated ? 'var(--orange)' : 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {d.latest}
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {!hasCves ? (
                        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>—</span>
                      ) : (
                        d.cves.map((c) => (
                          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 10, color: SEV_COLOR[c.severity], fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{c.id}</span>
                            <span style={{ fontSize: 9, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>· CVSS {c.cvss}</span>
                          </div>
                        ))
                      )}
                    </div>
                    <div>
                      {!hasCves || !worst ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 20, padding: '0 8px', borderRadius: 3, background: 'var(--low-dim)', border: '1px solid rgba(34,197,94,0.4)', color: 'var(--low)', fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--low)' }} />SAFE
                        </span>
                      ) : (
                        <SeverityChip sev={worst} />
                      )}
                    </div>
                    <span style={{ fontSize: 10, color: hasCves ? 'var(--low)' : 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                      {hasCves ? d.cves[0].fixed : '—'}
                    </span>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                      {hasCves && (
                        // API: POST /api/v1/projects/{projectId}/sbom/patch — { componentName, targetVersion }
                        <button
                          onClick={(e) => { e.stopPropagation(); }}
                          style={{ display: 'flex', alignItems: 'center', gap: 4, height: 24, padding: '0 8px', borderRadius: 4, background: 'var(--low-dim)', border: '1px solid rgba(34,197,94,0.3)', color: 'var(--low)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                        >
                          <Zap size={10} />업데이트
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); if (hasCves) setSelectedCve({ dep: d, cve: d.cves[0] }); }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 24, width: 24, padding: 0, borderRadius: 4, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-tertiary)', cursor: 'pointer' }}
                      >
                        <ChevronRight size={11} />
                      </button>
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          </div>

          {/* CVE Detail section */}
          {selectedCve && (
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em' }}>CVE 상세</h3>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>
                    선택된 취약점 — {selectedCve.dep.name}@{selectedCve.dep.version}
                  </div>
                </div>
              </div>
              <CveDetailCard dep={selectedCve.dep} cve={selectedCve.cve} />
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
