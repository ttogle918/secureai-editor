'use client';
import { useRouter } from 'next/navigation';
import { Key, Package, Github, Clock3 } from 'lucide-react';

const COLORS = {
  secretScan: '#34d399',
  sbom:       '#818cf8',
  monitoring: '#a78bfa',
} as const;

/**
 * 대시보드 자동화 빠른 액션 4-grid.
 * 시크릿 스캔/SBOM은 라우팅(SBOM은 projectId 게이트), PR 리뷰·예약 스캔은 준비 중(비활성).
 */
export function AutomationQuickActions({ projectId }: { projectId: string | null }) {
  const router = useRouter();

  return (
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
          <Key size={16} color={COLORS.secretScan} aria-hidden="true" />
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>시크릿 스캔</div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>커밋·코드 내 시크릿</div>
          </div>
        </button>

        {/* SBOM & CVE — projectId 있으면 페이지로 이동 */}
        <button
          onClick={() => { if (projectId) router.push(`/projects/${projectId}/sbom`); }}
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
          <Package size={16} color={COLORS.sbom} aria-hidden="true" />
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>SBOM & CVE</div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
              {projectId ? '컴포넌트 의존성 분석' : '프로젝트 선택 필요'}
            </div>
          </div>
        </button>

        {/* PR 자동 리뷰 — 준비 중(비활성) */}
        <div
          aria-disabled="true"
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6,
            padding: '12px 14px', borderRadius: 7,
            background: 'rgba(167,139,250,0.04)', border: '1px solid rgba(167,139,250,0.12)',
            opacity: 0.45, cursor: 'default',
          }}
        >
          <Github size={16} color={COLORS.monitoring} aria-hidden="true" />
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>PR 자동 리뷰</div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>준비 중</div>
          </div>
        </div>

        {/* 예약 스캔 — 준비 중(비활성) */}
        <div
          aria-disabled="true"
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6,
            padding: '12px 14px', borderRadius: 7,
            background: 'rgba(167,139,250,0.04)', border: '1px solid rgba(167,139,250,0.12)',
            opacity: 0.45, cursor: 'default',
          }}
        >
          <Clock3 size={16} color={COLORS.monitoring} aria-hidden="true" />
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>예약 자동 스캔</div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>준비 중</div>
          </div>
        </div>
      </div>
    </div>
  );
}
