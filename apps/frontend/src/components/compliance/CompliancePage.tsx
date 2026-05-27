'use client';
// components/compliance/CompliancePage.tsx
// 컴플라이언스 프레임워크 매핑 결과 화면
// V4 Hybrid — 4-탭 프레임워크, 섹션 그루핑, StatusBadge(4상태), 도넛 링, 필터 칩, 감사 추적 풋터

import { useState, useEffect, useCallback } from 'react';
import {
  Shield, CheckCircle2, XCircle, RefreshCw,
  ChevronDown, ChevronRight, FileText, Filter,
  Download, ExternalLink, Upload, History, ArrowLeft,
} from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { useSecureStore } from '@/store/useSecureStore';

// ─── 타입 정의 ──────────────────────────────────────────────────────────────

type Framework = 'ISO27001' | 'NIST_CSF' | 'OWASP_ASVS' | 'PCI_DSS';
type ControlStatus = 'compliant' | 'partial' | 'non_compliant' | 'na';
type FilterStatus = 'all' | ControlStatus;

interface ControlItem {
  id: string;
  name: string;
  status: ControlStatus;
  vulns: string[];
  evidence: string;
}

interface ControlSection {
  section: string;
  items: ControlItem[];
}

interface ComplianceReport {
  framework: Framework;
  sections: ControlSection[];
  updatedAt?: string;
  updatedBy?: string;
}

// ─── 프레임워크 메타 ─────────────────────────────────────────────────────────

const FRAMEWORKS: { id: Framework; label: string; subtitle: string }[] = [
  { id: 'ISO27001',   label: 'ISO 27001:2022',  subtitle: 'Annex A · 93 controls' },
  { id: 'NIST_CSF',   label: 'NIST CSF 2.0',    subtitle: '6 functions · 23 categories' },
  { id: 'OWASP_ASVS', label: 'OWASP ASVS',      subtitle: 'Application Security 4.0' },
  { id: 'PCI_DSS',    label: 'PCI-DSS v4.0',    subtitle: 'Payment Card Industry' },
];

// ─── 상태 메타 ──────────────────────────────────────────────────────────────

const STATUS_META: Record<ControlStatus, {
  label: string; short: string;
  color: string; dim: string; border: string;
}> = {
  compliant:     { label: '준수',     short: 'OK', color: 'var(--low)',           dim: 'var(--low-dim)',      border: 'rgba(34,197,94,0.35)' },
  partial:       { label: '부분 준수', short: '!',  color: 'var(--high)',           dim: 'var(--high-dim)',     border: 'rgba(245,158,11,0.35)' },
  non_compliant: { label: '미준수',   short: 'X',  color: 'var(--critical)',       dim: 'var(--critical-dim)', border: 'rgba(240,65,65,0.35)' },
  na:            { label: '해당없음', short: '—',  color: 'var(--text-tertiary)', dim: 'var(--bg-3)',         border: 'var(--border)' },
};

// ─── Mock 데이터 ─────────────────────────────────────────────────────────────

const MOCK_ISO: ComplianceReport = {
  framework: 'ISO27001',
  updatedAt: '2026-05-17 14:22:08 KST',
  updatedBy: 'jimin@shop-api · 매핑 알고리즘 v3.1',
  sections: [
    {
      section: 'A.5 — 조직적 통제',
      items: [
        { id: 'A.5.7',  name: '위협 정보 수집',           status: 'compliant',     vulns: [],             evidence: 'CVE 피드 연동 · 일일 자동 동기화' },
        { id: 'A.5.23', name: '클라우드 서비스 보안',      status: 'compliant',     vulns: [],             evidence: 'AWS Config + SCP 적용' },
        { id: 'A.5.30', name: 'ICT 준비도(연속성)',        status: 'partial',       vulns: [],             evidence: 'RPO 4h · RTO 미정의' },
      ],
    },
    {
      section: 'A.8 — 기술적 통제',
      items: [
        { id: 'A.8.2',  name: '특권 접근 권한',           status: 'non_compliant', vulns: ['v2'],          evidence: 'IAM 정책 미감사' },
        { id: 'A.8.5',  name: '안전한 인증',               status: 'partial',       vulns: ['v8'],          evidence: 'TOTP 미적용 사용자 12명' },
        { id: 'A.8.8',  name: '기술적 취약점 관리',        status: 'non_compliant', vulns: ['v1','v3','v5'], evidence: 'Critical 패치 SLA 초과' },
        { id: 'A.8.9',  name: '구성 관리',                 status: 'compliant',     vulns: [],             evidence: 'Terraform · drift 0' },
        { id: 'A.8.12', name: '데이터 유출 방지',          status: 'partial',       vulns: ['v2'],          evidence: 'DLP 일부 채널만 활성' },
        { id: 'A.8.24', name: '암호화 사용',               status: 'non_compliant', vulns: ['v7'],          evidence: 'MD5 사용 1건 잔존' },
        { id: 'A.8.28', name: '안전한 코딩',               status: 'partial',       vulns: ['v1','v3'],     evidence: 'SAST 통과율 86%' },
        { id: 'A.8.31', name: '개발/테스트/운영 환경 분리', status: 'compliant',     vulns: [],             evidence: 'VPC 분리 + IAM boundary' },
      ],
    },
    {
      section: 'A.6 — 인적 통제',
      items: [
        { id: 'A.6.3', name: '보안 인식 교육',           status: 'compliant', vulns: [], evidence: '연 2회 · 참여율 98%' },
        { id: 'A.6.8', name: '정보 보안 사고 보고',       status: 'na',        vulns: [], evidence: '해당 사고 없음' },
      ],
    },
  ],
};

const MOCK_NIST: ComplianceReport = {
  framework: 'NIST_CSF',
  updatedAt: '2026-05-17 14:22:08 KST',
  updatedBy: 'jimin@shop-api · 매핑 알고리즘 v3.1',
  sections: [
    {
      section: 'GV — Govern',
      items: [
        { id: 'GV.OC-01', name: '조직의 미션 이해',   status: 'compliant', vulns: [], evidence: '보안 정책 v2.3 승인' },
        { id: 'GV.RM-01', name: '리스크 관리 전략',   status: 'partial',   vulns: [], evidence: '연 1회만 재평가' },
      ],
    },
    {
      section: 'ID — Identify',
      items: [
        { id: 'ID.AM-08', name: '자산 인벤토리',    status: 'compliant',     vulns: [],          evidence: 'CMDB 자동 sync' },
        { id: 'ID.RA-01', name: '취약점 식별',      status: 'non_compliant', vulns: ['v1','v2'], evidence: 'Critical 미패치' },
      ],
    },
    {
      section: 'PR — Protect',
      items: [
        { id: 'PR.AA-01', name: '인증 정책',       status: 'partial',       vulns: ['v8'],      evidence: 'MFA 적용 88%' },
        { id: 'PR.DS-01', name: '저장 데이터 보호', status: 'non_compliant', vulns: ['v7'],      evidence: '약한 해시 사용' },
        { id: 'PR.IP-01', name: '안전한 SDLC',     status: 'partial',       vulns: ['v1','v3'], evidence: 'PR 보안 검토 누락' },
      ],
    },
    {
      section: 'DE — Detect',
      items: [
        { id: 'DE.CM-01', name: '네트워크 모니터링', status: 'compliant', vulns: [], evidence: 'SIEM + EDR' },
        { id: 'DE.AE-02', name: '이상 행위 탐지',   status: 'partial',   vulns: [], evidence: 'UEBA 일부 적용' },
      ],
    },
    {
      section: 'RS — Respond',
      items: [
        { id: 'RS.AN-01', name: '사고 조사', status: 'na', vulns: [], evidence: '해당 사고 없음' },
      ],
    },
  ],
};

const MOCK_ASVS: ComplianceReport = {
  framework: 'OWASP_ASVS',
  updatedAt: '2026-05-17 14:22:08 KST',
  updatedBy: 'jimin@shop-api · 매핑 알고리즘 v3.1',
  sections: [
    {
      section: 'V1 — Architecture',
      items: [
        { id: 'V1.1', name: 'Secure SDLC', status: 'partial', vulns: [], evidence: 'DevSecOps 일부 도입' },
        { id: 'V1.2', name: 'Authentication Architecture', status: 'compliant', vulns: [], evidence: 'OAuth2 + JWT' },
      ],
    },
    {
      section: 'V2 — Authentication',
      items: [
        { id: 'V2.1', name: 'Password Security', status: 'compliant', vulns: [], evidence: 'bcrypt rounds=12' },
        { id: 'V2.2', name: 'MFA Requirements', status: 'partial', vulns: ['v8'], evidence: 'TOTP 88% 적용' },
      ],
    },
  ],
};

const MOCK_PCI: ComplianceReport = {
  framework: 'PCI_DSS',
  updatedAt: '2026-05-17 14:22:08 KST',
  updatedBy: 'jimin@shop-api · 매핑 알고리즘 v3.1',
  sections: [
    {
      section: 'Req 6 — Secure Systems',
      items: [
        { id: '6.2.4', name: 'Software engineering techniques', status: 'partial', vulns: ['v1'], evidence: 'SAST 커버리지 86%' },
        { id: '6.3.1', name: 'Known vulnerabilities managed', status: 'non_compliant', vulns: ['v1','v3'], evidence: 'Critical SLA 초과' },
      ],
    },
    {
      section: 'Req 8 — Identity Management',
      items: [
        { id: '8.2.1', name: 'All user IDs managed', status: 'compliant', vulns: [], evidence: 'IdP 통합 완료' },
        { id: '8.3.6', name: 'MFA for all admin', status: 'partial', vulns: [], evidence: '일부 서비스 계정 미적용' },
      ],
    },
  ],
};

const MOCK_REPORTS: Record<Framework, ComplianceReport> = {
  ISO27001:   MOCK_ISO,
  NIST_CSF:   MOCK_NIST,
  OWASP_ASVS: MOCK_ASVS,
  PCI_DSS:    MOCK_PCI,
};

// ─── 서브 컴포넌트 ────────────────────────────────────────────────────────────

function StatusBadge({ status, compact = false }: { status: ControlStatus; compact?: boolean }) {
  const meta = STATUS_META[status];
  if (compact) {
    return (
      <span title={meta.label} style={{
        width: 22, height: 22, borderRadius: 5,
        background: meta.dim, color: meta.color,
        border: `1px solid ${meta.border}`,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 800, fontFamily: 'var(--font-mono)',
        flexShrink: 0,
      }}>
        {meta.short}
      </span>
    );
  }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      height: 22, padding: '0 8px', borderRadius: 4,
      background: meta.dim, color: meta.color,
      border: `1px solid ${meta.border}`,
      fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
      fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: meta.color, flexShrink: 0 }} />
      {meta.label.toUpperCase()}
    </span>
  );
}

function ComplianceRing({ rate }: { rate: number }) {
  const size = 80;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (rate / 100) * c;
  const color = rate >= 80 ? 'var(--low)' : rate >= 50 ? 'var(--high)' : 'var(--critical)';

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-3)" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${c}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dasharray 0.5s ease' }}
      />
      <text x={size / 2} y={size / 2 + 6} textAnchor="middle"
        fontSize="20" fontWeight="700" fontFamily="var(--font-mono)" fill="var(--text-primary)">
        {rate}
      </text>
    </svg>
  );
}

function SummaryStat({ label, value, status }: { label: string; value: number; status: ControlStatus }) {
  const meta = STATUS_META[status];
  return (
    <div style={{
      background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8,
      padding: 16, display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: meta.color }} />
        <span style={{ fontSize: 9, fontWeight: 700, color: meta.color, letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>
          {label.toUpperCase()}
        </span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: meta.color, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>
        {value}
      </div>
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

export function CompliancePage() {
  const projectId       = useSecureStore((s) => s.projectId);
  const lockedSessionId = useSecureStore((s) => s.lockedSessionId);

  const [framework, setFramework] = useState<Framework>('ISO27001');
  const [report, setReport]       = useState<ComplianceReport>(MOCK_ISO);
  const [loading, setLoading]     = useState(false);
  const [usingMock, setUsingMock] = useState(true);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');

  // API: GET /api/v1/projects/{projectId}/sessions/{sessionId}/compliance?framework=ISO27001|NIST_CSF|OWASP_ASVS|PCI_DSS
  const fetchCompliance = useCallback((fw: Framework) => {
    if (!projectId || !lockedSessionId) {
      setReport(MOCK_REPORTS[fw]);
      setUsingMock(true);
      return;
    }

    setLoading(true);
    apiClient
      .get<{ data: ComplianceReport }>(
        `/projects/${projectId}/sessions/${lockedSessionId}/compliance?framework=${fw}`,
      )
      .then((res) => {
        setReport(res.data);
        setUsingMock(false);
      })
      .catch(() => {
        setReport(MOCK_REPORTS[fw]);
        setUsingMock(true);
      })
      .finally(() => setLoading(false));
  }, [projectId, lockedSessionId]);

  useEffect(() => {
    fetchCompliance(framework);
  }, [framework, fetchCompliance]);

  const handleFrameworkChange = (fw: Framework) => {
    setFramework(fw);
    setCollapsedSections(new Set());
    setFilterStatus('all');
  };

  const toggleSection = (section: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  // KPI 집계
  const allItems        = report.sections.flatMap((s) => s.items);
  const totalControls   = allItems.length;
  const compliantCount  = allItems.filter((i) => i.status === 'compliant').length;
  const partialCount    = allItems.filter((i) => i.status === 'partial').length;
  const nonCompliantCnt = allItems.filter((i) => i.status === 'non_compliant').length;
  const naCount         = allItems.filter((i) => i.status === 'na').length;
  const applicableCnt   = Math.max(totalControls - naCount, 1);
  const complianceRate  = Math.round((compliantCount / applicableCnt) * 100);

  // 필터 적용
  const filteredSections: ControlSection[] = filterStatus === 'all'
    ? report.sections
    : report.sections.map((sec) => ({
        ...sec,
        items: sec.items.filter((i) => i.status === filterStatus),
      })).filter((sec) => sec.items.length > 0);

  const activeFramework = FRAMEWORKS.find((f) => f.id === framework)!;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-0)' }}>

      {/* ── 헤더 ─────────────────────────────────────────────────────────── */}
      <div style={{
        height: 56, flexShrink: 0,
        background: 'var(--bg-1)', borderBottom: '1px solid var(--hairline)',
        display: 'flex', alignItems: 'center', padding: '0 24px', gap: 14,
      }}>
        <button style={{
          width: 32, height: 32, borderRadius: 7, border: '1px solid var(--border)',
          background: 'var(--bg-2)', color: 'var(--text-secondary)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
          onClick={() => history.back()}
          title="뒤로 가기"
        >
          <ArrowLeft size={13} />
        </button>

        <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--tag-3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FileText size={14} color="#fff" />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>컴플라이언스 매핑</div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
            {activeFramework.label} · {activeFramework.subtitle}
            {loading && <span style={{ marginLeft: 8 }}>로딩 중…</span>}
            {!loading && usingMock && (
              <span style={{
                marginLeft: 8, color: 'var(--orange)', fontWeight: 700,
                padding: '1px 5px', borderRadius: 3,
                background: 'var(--orange-dim)', border: '1px solid rgba(249,115,22,0.3)',
              }}>MOCK</span>
            )}
          </div>
        </div>
        <div style={{ flex: 1 }} />

        {/* 버튼 그룹 */}
        <button
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 12px', borderRadius: 6,
            background: 'var(--bg-3)', border: '1px solid var(--border)',
            color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer', fontWeight: 600,
          }}
          title="필터"
        >
          <Filter size={11} />필터
        </button>

        {/* API: GET /api/v1/projects/{projectId}/sessions/{sessionId}/compliance/export?format=pdf */}
        <button
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 12px', borderRadius: 6,
            background: 'var(--bg-3)', border: '1px solid var(--border)',
            color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer', fontWeight: 600,
          }}
          title="감사 리포트 PDF 다운로드"
        >
          <Download size={11} />감사 리포트
        </button>

        {/* API: POST /api/v1/projects/{projectId}/sessions/{sessionId}/compliance/remap */}
        <button
          onClick={() => fetchCompliance(framework)}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 12px', borderRadius: 6,
            background: 'var(--orange-dim)', border: '1px solid rgba(249,115,22,0.4)',
            color: 'var(--orange)', fontSize: 11, cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: 700, opacity: loading ? 0.55 : 1,
          }}
        >
          <RefreshCw size={11} />매핑 재실행
        </button>
      </div>

      {/* ── 프레임워크 탭 ─────────────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0,
        background: 'var(--bg-1)', borderBottom: '1px solid var(--hairline)',
        display: 'flex', alignItems: 'center', padding: '0 24px', gap: 0,
        overflowX: 'auto',
      }}>
        {FRAMEWORKS.map((f) => {
          const isActive = framework === f.id;
          return (
            // API: GET /api/v1/projects/{projectId}/sessions/{sessionId}/compliance?framework={f.id}
            <button
              key={f.id}
              onClick={() => handleFrameworkChange(f.id)}
              style={{
                padding: '12px 20px', border: 'none', background: 'transparent',
                borderBottom: isActive ? '2px solid var(--orange-2)' : '2px solid transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
                display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2,
                transition: 'color .12s, border-color .12s', flexShrink: 0,
              }}
            >
              <span style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{f.label}</span>
              <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', fontWeight: 500 }}>
                {f.subtitle}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── 본문 ─────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg-0)' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '24px 24px 48px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* 요약 카드 그리드 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr repeat(4, 1fr)', gap: 12 }}>

            {/* 준수율 도넛 카드 */}
            <div style={{
              border: '1px solid var(--border)', borderRadius: 8,
              padding: 20,
              background: 'radial-gradient(circle at 80% 30%, rgba(59,130,246,0.06), var(--bg-2) 70%)',
              display: 'flex', alignItems: 'center', gap: 18,
            }}>
              <ComplianceRing rate={complianceRate} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>
                  종합 준수율
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1, marginBottom: 6, fontFamily: 'var(--font-mono)' }}>
                  {complianceRate}%
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {compliantCount} / {applicableCnt} 통제 항목 준수
                  <span style={{ color: 'var(--text-tertiary)' }}> · 해당없음 {naCount} 제외</span>
                </div>
              </div>
            </div>

            <SummaryStat label="준수"      value={compliantCount}  status="compliant" />
            <SummaryStat label="부분 준수" value={partialCount}    status="partial" />
            <SummaryStat label="미준수"    value={nonCompliantCnt} status="non_compliant" />
            <SummaryStat label="해당없음"  value={naCount}         status="na" />
          </div>

          {/* 필터 칩 + 검색 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>필터</span>

            {([ ['all', `전체 ${totalControls}`, undefined],
               ['non_compliant', `미준수 ${nonCompliantCnt}`, 'var(--critical)'],
               ['partial',       `부분 ${partialCount}`,      'var(--high)'],
               ['compliant',     `준수 ${compliantCount}`,    'var(--low)'],
            ] as [FilterStatus, string, string | undefined][]).map(([val, label, dotColor]) => (
              <button
                key={val}
                onClick={() => setFilterStatus(val)}
                style={{
                  height: 22, padding: '0 10px', borderRadius: 4, cursor: 'pointer',
                  background: filterStatus === val ? 'var(--bg-3)' : 'var(--bg-2)',
                  border: `1px solid ${filterStatus === val ? 'var(--orange-2)' : 'var(--border)'}`,
                  color: filterStatus === val ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5,
                  fontFamily: 'var(--font-mono)', transition: 'all 0.12s',
                }}
              >
                {dotColor && <span style={{ width: 5, height: 5, borderRadius: '50%', background: dotColor }} />}
                {label}
              </button>
            ))}

            <div style={{ flex: 1 }} />

            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 10px', borderRadius: 5,
              background: 'var(--bg-2)', border: '1px solid var(--border)',
              fontSize: 11, color: 'var(--text-tertiary)',
            }}>
              <Shield size={11} />
              <span>통제 항목 검색…</span>
              <span style={{
                padding: '1px 4px', borderRadius: 3,
                background: 'var(--bg-3)', border: '1px solid var(--border)',
                fontSize: 9, fontFamily: 'var(--font-mono)',
              }}>⌘F</span>
            </div>
          </div>

          {/* 매트릭스 테이블 */}
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>

            {/* 테이블 헤더 */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '90px 1fr 140px 200px 80px',
              gap: 12, padding: '10px 16px',
              fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
              color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)',
              background: 'var(--bg-3)', borderBottom: '1px solid var(--hairline)',
            }}>
              <span>통제 ID</span>
              <span>통제 이름 / 근거</span>
              <span>준수 상태</span>
              <span>연관 취약점</span>
              <span style={{ textAlign: 'right' }}>액션</span>
            </div>

            {filteredSections.length === 0 ? (
              <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>
                해당하는 통제 항목이 없습니다
              </div>
            ) : filteredSections.map((sec, si) => {
              const isCollapsed = collapsedSections.has(sec.section);
              return (
                <div key={si}>
                  {/* 섹션 헤더 */}
                  <button
                    onClick={() => toggleSection(sec.section)}
                    style={{
                      width: '100%', padding: '8px 16px',
                      background: 'var(--bg-3)',
                      borderBottom: '1px solid var(--hairline)',
                      borderTop: si > 0 ? '1px solid var(--hairline)' : 'none',
                      border: 'none', cursor: 'pointer',
                      fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)',
                      letterSpacing: '0.04em', fontFamily: 'var(--font-mono)',
                      display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left',
                    }}
                  >
                    {isCollapsed
                      ? <ChevronRight size={10} color="var(--text-tertiary)" />
                      : <ChevronDown  size={10} color="var(--text-tertiary)" />
                    }
                    {sec.section}
                    <span style={{ color: 'var(--text-tertiary)', fontWeight: 500 }}>· {sec.items.length}건</span>
                  </button>

                  {/* 통제 항목들 */}
                  {!isCollapsed && sec.items.map((item, ii) => (
                    <div
                      key={item.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '90px 1fr 140px 200px 80px',
                        gap: 12, padding: '12px 16px',
                        alignItems: 'center', fontSize: 12,
                        borderBottom: ii === sec.items.length - 1 ? 'none' : '1px solid var(--hairline)',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-3)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* 통제 ID */}
                      <span style={{
                        fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)',
                        color: STATUS_META[item.status].color,
                      }}>
                        {item.id}
                      </span>

                      {/* 이름 + 근거 */}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{item.name}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                          근거 · {item.evidence}
                        </div>
                      </div>

                      {/* 상태 배지 */}
                      <StatusBadge status={item.status} />

                      {/* 연관 취약점 */}
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {item.vulns.length === 0 ? (
                          <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>—</span>
                        ) : item.vulns.map((vid) => (
                          <span key={vid} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 3,
                            padding: '2px 6px', borderRadius: 3,
                            background: 'var(--critical-dim)', border: '1px solid rgba(240,65,65,0.30)',
                            color: 'var(--critical)', fontSize: 10, fontWeight: 700,
                            fontFamily: 'var(--font-mono)', cursor: 'pointer',
                          }}>
                            <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--critical)' }} />
                            #{vid}
                          </span>
                        ))}
                      </div>

                      {/* 액션 버튼 */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                        <button title="상세 보기" style={{
                          width: 22, height: 22, borderRadius: 4,
                          border: '1px solid var(--border)', background: 'var(--bg-3)',
                          color: 'var(--text-secondary)', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <ExternalLink size={10} />
                        </button>
                        <button title="증빙 첨부" style={{
                          width: 22, height: 22, borderRadius: 4,
                          border: '1px solid var(--border)', background: 'var(--bg-3)',
                          color: 'var(--text-secondary)', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Upload size={10} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {/* 준수율 바 */}
          <div style={{
            background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10,
            padding: '20px 24px',
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)', marginBottom: 10 }}>
              준수율 현황
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ flex: 1, height: 8, borderRadius: 99, background: 'var(--bg-3)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 99,
                  width: `${complianceRate}%`,
                  background: complianceRate >= 80 ? 'var(--low)' : complianceRate >= 50 ? 'var(--high)' : 'var(--critical)',
                  transition: 'width 0.5s ease',
                }} />
              </div>
              <span style={{
                fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-mono)',
                color: complianceRate >= 80 ? 'var(--low)' : complianceRate >= 50 ? 'var(--high)' : 'var(--critical)',
                minWidth: 42, textAlign: 'right',
              }}>
                {complianceRate}%
              </span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 8 }}>
              {compliantCount}/{applicableCnt} 컨트롤 준수 · {activeFramework.label} 기준
            </div>
          </div>

          {/* 감사 추적 풋터 */}
          <div style={{
            padding: '14px 18px', borderRadius: 8,
            background: 'var(--bg-2)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 14,
            fontSize: 11, color: 'var(--text-secondary)',
          }}>
            <FileText size={14} color="var(--info)" />
            <span>
              <strong style={{ color: 'var(--text-primary)' }}>감사 추적</strong> ·
              마지막 매핑 갱신:{' '}
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                {report.updatedAt ?? '—'}
              </span>
              {report.updatedBy && (
                <span style={{ color: 'var(--text-tertiary)', marginLeft: 8 }}>by {report.updatedBy}</span>
              )}
            </span>
            <div style={{ flex: 1 }} />
            <button style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 10px', borderRadius: 5,
              background: 'transparent', border: '1px solid var(--border)',
              color: 'var(--text-tertiary)', fontSize: 11, cursor: 'pointer',
            }}>
              <History size={11} />이력 보기
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
