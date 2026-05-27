'use client';
// components/compliance/CompliancePage.tsx
// 컴플라이언스 프레임워크 매핑 결과 화면
// API: GET /api/v1/projects/{projectId}/sessions/{sessionId}/compliance?framework=ISO27001|NIST_CSF

import { useState, useEffect } from 'react';
import { Shield, CheckCircle2, XCircle, RefreshCw, ChevronRight } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { useSecureStore } from '@/store/useSecureStore';

// ─── 타입 정의 ──────────────────────────────────────────────────────────────

type Framework = 'ISO27001' | 'NIST_CSF';

interface ControlResult {
  controlId: string;
  controlName: string;
  owaspCategory: string;
  compliant: boolean;
  vulnerabilityCount: number;
}

interface ComplianceReport {
  framework: Framework;
  controls: ControlResult[];
}

// ─── Mock 데이터 (프로젝트/세션 미선택 시 fallback) ──────────────────────────

const MOCK_ISO: ComplianceReport = {
  framework: 'ISO27001',
  controls: [
    { controlId: 'A.9.4.1',  controlName: 'Use of Privileged Utility Programs',                      owaspCategory: 'A01 Broken Access Control',                      compliant: false, vulnerabilityCount: 3 },
    { controlId: 'A.14.2.5', controlName: 'Secure system engineering principles',                     owaspCategory: 'A03 Injection',                                  compliant: false, vulnerabilityCount: 2 },
    { controlId: 'A.10.1.1', controlName: 'Policy on the use of cryptographic controls',              owaspCategory: 'A02 Cryptographic Failures',                     compliant: false, vulnerabilityCount: 1 },
    { controlId: 'A.6.1.2',  controlName: 'Segregation of duties',                                    owaspCategory: 'A10 Server-Side Request Forgery',                compliant: true,  vulnerabilityCount: 0 },
    { controlId: 'A.9.2.1',  controlName: 'User registration and de-registration',                    owaspCategory: 'A07 Identification and Authentication Failures', compliant: true,  vulnerabilityCount: 0 },
    { controlId: 'A.12.4.1', controlName: 'Event logging',                                            owaspCategory: 'A09 Security Logging and Monitoring Failures',   compliant: true,  vulnerabilityCount: 0 },
    { controlId: 'A.12.6.1', controlName: 'Management of technical vulnerabilities',                  owaspCategory: 'A06 Vulnerable and Outdated Components',         compliant: true,  vulnerabilityCount: 0 },
    { controlId: 'A.14.1.2', controlName: 'Securing application services on public networks',         owaspCategory: 'A05 Security Misconfiguration',                  compliant: true,  vulnerabilityCount: 0 },
  ],
};

const MOCK_NIST: ComplianceReport = {
  framework: 'NIST_CSF',
  controls: [
    { controlId: 'PR.AC-4', controlName: 'Access permissions and authorizations are managed',         owaspCategory: 'A01 Broken Access Control',                      compliant: false, vulnerabilityCount: 3 },
    { controlId: 'DE.CM-4', controlName: 'Malicious code is detected',                               owaspCategory: 'A03 Injection',                                  compliant: false, vulnerabilityCount: 2 },
    { controlId: 'PR.DS-1', controlName: 'Data-at-rest is protected',                                owaspCategory: 'A02 Cryptographic Failures',                     compliant: false, vulnerabilityCount: 1 },
    { controlId: 'DE.AE-3', controlName: 'Event data are aggregated and correlated',                 owaspCategory: 'A09 Security Logging and Monitoring Failures',   compliant: true,  vulnerabilityCount: 0 },
    { controlId: 'ID.RA-1', controlName: 'Asset vulnerabilities are identified and documented',       owaspCategory: 'A06 Vulnerable and Outdated Components',         compliant: true,  vulnerabilityCount: 0 },
    { controlId: 'PR.AC-1', controlName: 'Identities and credentials are managed',                   owaspCategory: 'A07 Identification and Authentication Failures', compliant: true,  vulnerabilityCount: 0 },
    { controlId: 'PR.IP-12', controlName: 'Vulnerability management plan developed/implemented',      owaspCategory: 'A05 Security Misconfiguration',                  compliant: true,  vulnerabilityCount: 0 },
  ],
};

const MOCK_REPORTS: Record<Framework, ComplianceReport> = {
  ISO27001: MOCK_ISO,
  NIST_CSF: MOCK_NIST,
};

// ─── 서브 컴포넌트 ────────────────────────────────────────────────────────────

function KpiStat({ label, value, color = 'var(--text-primary)', divider }: {
  label: string; value: number; color?: string; divider?: boolean;
}) {
  return (
    <>
      <div style={{ flex: 1, padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 500, letterSpacing: '0.02em' }}>{label}</span>
        <span style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1, fontFamily: 'var(--font-mono)' }}>{value}</span>
      </div>
      {divider && <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--hairline)', margin: '12px 0' }} />}
    </>
  );
}

function FrameworkTab({ fw, active, onClick }: {
  fw: Framework; active: boolean; onClick: () => void;
}) {
  const labels: Record<Framework, string> = {
    ISO27001: 'ISO 27001',
    NIST_CSF: 'NIST CSF',
  };
  return (
    <button
      onClick={onClick}
      style={{
        height: 30, padding: '0 14px', borderRadius: 6,
        background: active ? 'var(--bg-3)' : 'transparent',
        border: `1px solid ${active ? 'var(--border-3)' : 'transparent'}`,
        color: active ? 'var(--text-active)' : 'var(--text-tertiary)',
        fontSize: 11, fontWeight: 700, cursor: 'pointer',
        letterSpacing: '0.02em', transition: 'all 0.15s',
      }}
    >
      {labels[fw]}
    </button>
  );
}

function ComplianceBadge({ compliant }: { compliant: boolean }) {
  return compliant ? (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      height: 20, padding: '0 8px', borderRadius: 3,
      background: 'var(--low-dim)', border: '1px solid rgba(34,197,94,0.4)',
      color: 'var(--low)', fontSize: 10, fontWeight: 700,
      fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', whiteSpace: 'nowrap',
    }}>
      <CheckCircle2 size={10} />COMPLIANT
    </span>
  ) : (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      height: 20, padding: '0 8px', borderRadius: 3,
      background: 'var(--critical-dim)', border: '1px solid rgba(240,65,65,0.4)',
      color: 'var(--critical)', fontSize: 10, fontWeight: 700,
      fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', whiteSpace: 'nowrap',
    }}>
      <XCircle size={10} />NON-COMPLIANT
    </span>
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
  const [expanded, setExpanded]   = useState<string | null>(null);

  useEffect(() => {
    if (!projectId || !lockedSessionId) {
      setReport(MOCK_REPORTS[framework]);
      setUsingMock(true);
      return;
    }

    setLoading(true);
    apiClient
      .get<{ data: ComplianceReport }>(
        `/projects/${projectId}/sessions/${lockedSessionId}/compliance?framework=${framework}`,
      )
      .then((res) => {
        setReport(res.data);
        setUsingMock(false);
      })
      .catch(() => {
        setReport(MOCK_REPORTS[framework]);
        setUsingMock(true);
      })
      .finally(() => setLoading(false));
  }, [projectId, lockedSessionId, framework]);

  const handleFrameworkChange = (fw: Framework) => {
    setFramework(fw);
    setExpanded(null);
  };

  // KPI 집계
  const totalControls     = report.controls.length;
  const compliantCount    = report.controls.filter((c) => c.compliant).length;
  const nonCompliantCount = totalControls - compliantCount;
  const complianceRate    = totalControls > 0 ? Math.round((compliantCount / totalControls) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-0)' }}>

      {/* ── 헤더 ─────────────────────────────────────────────────────────── */}
      <div style={{
        height: 48, flexShrink: 0,
        background: 'var(--bg-1)', borderBottom: '1px solid var(--hairline)',
        display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 24, height: 24, borderRadius: 6,
            background: 'var(--tag-3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Shield size={13} color="#fff" />
          </div>
          <span style={{ fontSize: 13, fontWeight: 700 }}>컴플라이언스 매핑</span>
          <ChevronRight size={11} color="var(--text-tertiary)" />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
            {framework}
          </span>
          {loading && (
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
              로딩 중...
            </span>
          )}
          {!loading && usingMock && (
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

        {/* 프레임워크 선택 탭 */}
        <div style={{ display: 'flex', gap: 4 }}>
          <FrameworkTab fw="ISO27001" active={framework === 'ISO27001'} onClick={() => handleFrameworkChange('ISO27001')} />
          <FrameworkTab fw="NIST_CSF" active={framework === 'NIST_CSF'} onClick={() => handleFrameworkChange('NIST_CSF')} />
        </div>

        <button
          onClick={() => {
            if (!projectId || !lockedSessionId) return;
            setLoading(true);
            apiClient
              .get<{ data: ComplianceReport }>(
                `/projects/${projectId}/sessions/${lockedSessionId}/compliance?framework=${framework}`,
              )
              .then((res) => { setReport(res.data); setUsingMock(false); })
              .catch(() => { setReport(MOCK_REPORTS[framework]); setUsingMock(true); })
              .finally(() => setLoading(false));
          }}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 12px', borderRadius: 6,
            background: 'var(--bg-3)', border: '1px solid var(--border)',
            color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', fontWeight: 600,
          }}
        >
          <RefreshCw size={11} />새로고침
        </button>
      </div>

      {/* ── 본문 ─────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ padding: '28px 28px 48px', maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 28 }}>

          {/* KPI 띠 */}
          <div style={{
            display: 'flex',
            background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10,
          }}>
            <KpiStat label="전체 컨트롤"  value={totalControls}     divider />
            <KpiStat label="준수"          value={compliantCount}    color="var(--low)"      divider />
            <KpiStat label="미준수"        value={nonCompliantCount} color="var(--critical)" divider />
            <KpiStat label="준수율 (%)"    value={complianceRate}    color={complianceRate >= 80 ? 'var(--low)' : complianceRate >= 50 ? 'var(--medium)' : 'var(--critical)'} />
          </div>

          {/* 컨트롤 목록 */}
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em' }}>컨트롤 항목</h3>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>
                  미준수 컨트롤이 상단에 표시됩니다
                </div>
              </div>
            </div>

            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>

              {/* 테이블 헤더 */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '160px 1fr 220px 100px 80px',
                gap: 16, padding: '12px 22px',
                fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)',
                background: 'var(--bg-3)', borderBottom: '1px solid var(--hairline)',
              }}>
                <span>컨트롤 ID</span>
                <span>컨트롤명</span>
                <span>OWASP 카테고리</span>
                <span>준수 여부</span>
                <span style={{ textAlign: 'right' }}>취약점 수</span>
              </div>

              {/* 행 */}
              {report.controls.map((ctrl, idx) => {
                const isExpanded = expanded === ctrl.controlId;
                const isLast     = idx === report.controls.length - 1;
                return (
                  <div key={ctrl.controlId}>
                    <div
                      onClick={() => setExpanded(isExpanded ? null : ctrl.controlId)}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '160px 1fr 220px 100px 80px',
                        gap: 16, padding: '14px 22px',
                        alignItems: 'center', fontSize: 12,
                        borderBottom: (!isLast || isExpanded) ? '1px solid var(--hairline)' : 'none',
                        cursor: 'pointer',
                        background: isExpanded ? 'var(--bg-3)' : 'transparent',
                        transition: 'background 0.1s',
                      }}
                    >
                      {/* 컨트롤 ID */}
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontWeight: 700,
                        color: ctrl.compliant ? 'var(--text-secondary)' : 'var(--critical)',
                        fontSize: 11,
                      }}>
                        {ctrl.controlId}
                      </span>

                      {/* 컨트롤명 */}
                      <span style={{ color: 'var(--text-primary)', fontSize: 12, lineHeight: 1.4 }}>
                        {ctrl.controlName}
                      </span>

                      {/* OWASP 카테고리 */}
                      <span style={{
                        display: 'inline-flex', alignItems: 'center',
                        height: 20, padding: '0 8px', borderRadius: 3, width: 'fit-content',
                        background: 'var(--bg-3)', border: '1px solid var(--border-2)',
                        color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600,
                        fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap',
                      }}>
                        {ctrl.owaspCategory}
                      </span>

                      {/* 준수 여부 */}
                      <ComplianceBadge compliant={ctrl.compliant} />

                      {/* 취약점 수 */}
                      <span style={{
                        textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700,
                        color: ctrl.vulnerabilityCount === 0 ? 'var(--text-tertiary)' : 'var(--critical)',
                        fontSize: 13,
                      }}>
                        {ctrl.vulnerabilityCount === 0 ? '—' : ctrl.vulnerabilityCount}
                      </span>
                    </div>

                    {/* 확장 상세 패널 */}
                    {isExpanded && (
                      <div style={{
                        padding: '18px 22px 20px 32px',
                        background: 'var(--bg-1)',
                        borderBottom: isLast ? 'none' : '1px solid var(--hairline)',
                        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24,
                      }}>
                        {/* 왼쪽: 컨트롤 설명 */}
                        <div>
                          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.08em', marginBottom: 8, fontFamily: 'var(--font-mono)' }}>
                            컨트롤 상세
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                            <strong style={{ color: 'var(--text-primary)' }}>{ctrl.controlId}</strong>
                            &nbsp;— {ctrl.controlName}
                          </div>
                          <div style={{ marginTop: 12, fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                            OWASP 매핑: {ctrl.owaspCategory}
                          </div>
                        </div>

                        {/* 오른쪽: 준수 상태 요약 */}
                        <div>
                          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.08em', marginBottom: 8, fontFamily: 'var(--font-mono)' }}>
                            준수 상태
                          </div>
                          {ctrl.compliant ? (
                            <div style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              padding: '10px 14px', borderRadius: 8,
                              background: 'var(--low-dim)', border: '1px solid rgba(34,197,94,0.3)',
                            }}>
                              <CheckCircle2 size={16} color="var(--low)" />
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--low)' }}>준수</div>
                                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
                                  해당 카테고리 취약점 없음
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              padding: '10px 14px', borderRadius: 8,
                              background: 'var(--critical-dim)', border: '1px solid rgba(240,65,65,0.3)',
                            }}>
                              <XCircle size={16} color="var(--critical)" />
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--critical)' }}>미준수</div>
                                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
                                  취약점 {ctrl.vulnerabilityCount}건 — 보안 조치 필요
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 준수 현황 요약 바 */}
          <div style={{
            background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10,
            padding: '20px 24px',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)', marginBottom: 10 }}>
              준수율 현황
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                flex: 1, height: 8, borderRadius: 99,
                background: 'var(--bg-3)', overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${complianceRate}%`,
                  borderRadius: 99,
                  background: complianceRate >= 80 ? 'var(--low)' : complianceRate >= 50 ? 'var(--medium)' : 'var(--critical)',
                  transition: 'width 0.4s ease',
                }} />
              </div>
              <span style={{
                fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-mono)',
                color: complianceRate >= 80 ? 'var(--low)' : complianceRate >= 50 ? 'var(--medium)' : 'var(--critical)',
                minWidth: 42, textAlign: 'right',
              }}>
                {complianceRate}%
              </span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 8 }}>
              {compliantCount}/{totalControls} 컨트롤 준수 · {framework === 'ISO27001' ? 'ISO/IEC 27001:2022' : 'NIST Cybersecurity Framework v1.1'} 기준
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
