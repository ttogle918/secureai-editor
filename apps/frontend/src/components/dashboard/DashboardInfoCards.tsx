'use client';
import { useRouter } from 'next/navigation';
import { CreditCard, ClipboardList, Activity, ChevronRight, AlertCircle } from 'lucide-react';

const COLORS = {
  credits:    '#f97316',
  compliance: '#569cd6',
  monitoring: '#a78bfa',
  byok:       '#818cf8',
  disabled:   'rgba(255,255,255,0.2)',
} as const;

/** DashboardPage가 useCredits()에서 받는 데이터 중 이 카드가 쓰는 필드 */
export interface CreditsInfo {
  balance: number;
  hasByok: boolean;
  plan: { name: string; displayName?: string };
}

interface Props {
  creditsData: CreditsInfo | null | undefined;
  creditsLoading: boolean;
  projectId: string | null;
}

/**
 * 대시보드 정보 카드 3열 — 크레딧 잔액(실데이터) / 컴플라이언스(nav) / 도메인 모니터링(준비 중).
 */
export function DashboardInfoCards({ creditsData, creditsLoading, projectId }: Props) {
  const router = useRouter();

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>

      {/* 크레딧 현황 카드 — 실제 balance */}
      <div style={{
        background: 'var(--bg-2)', border: '1px solid var(--border)',
        borderRadius: 8, padding: '16px 20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>크레딧 잔액</span>
          <CreditCard size={14} color={COLORS.credits} aria-hidden="true" />
        </div>
        {creditsLoading ? (
          <div style={{ fontSize: 12, color: 'var(--text-disabled)', fontFamily: 'var(--font-mono)' }}>불러오는 중...</div>
        ) : creditsData ? (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
              <span style={{ fontSize: 28, fontWeight: 700, color: COLORS.credits, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>
                {creditsData.balance.toLocaleString()}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>크레딧</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                fontSize: 9, padding: '1px 6px', borderRadius: 3,
                background: 'rgba(249,115,22,0.12)', color: COLORS.credits,
                fontFamily: 'var(--font-mono)', fontWeight: 700,
              }}>
                {creditsData.plan.displayName || creditsData.plan.name}
              </span>
              {creditsData.hasByok && (
                <span style={{
                  fontSize: 9, padding: '1px 6px', borderRadius: 3,
                  background: 'rgba(129,140,248,0.12)', color: COLORS.byok,
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

      {/* 컴플라이언스 카드 — nav (projectId 게이트) */}
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
          <ClipboardList size={14} color={projectId ? COLORS.compliance : COLORS.disabled} aria-hidden="true" />
        </div>
        <div style={{ fontSize: 13, color: projectId ? COLORS.compliance : 'var(--text-disabled)', fontWeight: 600, marginBottom: 4 }}>
          {projectId ? '규정 준수 현황 보기' : '프로젝트 선택 필요'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-tertiary)' }}>
          {projectId
            ? <><span>OWASP · ISMS-P · 행안부</span><ChevronRight size={11} /></>
            : <><AlertCircle size={11} /><span>사이드바에서 프로젝트를 선택하세요</span></>}
        </div>
      </button>

      {/* 도메인 모니터링 카드 — 준비 중(비활성) */}
      <div
        aria-disabled="true"
        style={{
          background: 'var(--bg-2)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '16px 20px', opacity: 0.45,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>도메인 모니터링</span>
          <Activity size={14} color={COLORS.disabled} aria-hidden="true" />
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-disabled)', fontWeight: 600, marginBottom: 4 }}>준비 중</div>
        <div style={{
          display: 'inline-flex', alignItems: 'center',
          fontSize: 9, padding: '1px 6px', borderRadius: 3,
          background: 'rgba(167,139,250,0.08)', color: COLORS.monitoring,
          fontFamily: 'var(--font-mono)', fontWeight: 700,
        }}>
          COMING SOON
        </div>
      </div>
    </div>
  );
}
