'use client';
import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api/client';
import { CheckCircle2, XCircle } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Plan {
  id: number;
  name: string;
  displayName: string;
  priceMonthly: number;
  maxMembers: number;
  sastMonthlyLimit: number;
  allowDast: boolean;
  allowMonitoring: boolean;
  allowApiAccess: boolean;
  creditGrantMonthly: number;
}

// Fallback 하드코딩 데이터 — API가 없을 때 사용
const FALLBACK_PLANS: Plan[] = [
  {
    id: 1,
    name: 'free',
    displayName: 'Free',
    priceMonthly: 0,
    maxMembers: 1,
    sastMonthlyLimit: 30,
    allowDast: false,
    allowMonitoring: false,
    allowApiAccess: false,
    creditGrantMonthly: 100,
  },
  {
    id: 2,
    name: 'pro',
    displayName: 'Pro',
    priceMonthly: 29,
    maxMembers: 1,
    sastMonthlyLimit: 500,
    allowDast: true,
    allowMonitoring: false,
    allowApiAccess: false,
    creditGrantMonthly: 1000,
  },
  {
    id: 3,
    name: 'team',
    displayName: 'Team',
    priceMonthly: 99,
    maxMembers: 10,
    sastMonthlyLimit: 2000,
    allowDast: true,
    allowMonitoring: true,
    allowApiAccess: true,
    creditGrantMonthly: 5000,
  },
  {
    id: 4,
    name: 'enterprise',
    displayName: 'Enterprise',
    priceMonthly: 0,
    maxMembers: 9999,
    sastMonthlyLimit: 99999,
    allowDast: true,
    allowMonitoring: true,
    allowApiAccess: true,
    creditGrantMonthly: 50000,
  },
];

const PLAN_COLORS: Record<string, string> = {
  free: 'rgba(255,255,255,0.35)',
  pro: '#ea580c',
  team: '#f59e0b',
  enterprise: '#818cf8',
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function BoolCell({ value }: { value: boolean }) {
  return value
    ? <CheckCircle2 size={15} color="#22c55e" />
    : <XCircle size={15} color="rgba(255,255,255,0.2)" />;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<Plan[]>(FALLBACK_PLANS);
  const [loading, setLoading] = useState(true);
  const [fromFallback, setFromFallback] = useState(false);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);

  useEffect(() => {
    apiClient
      .get<{ data: Plan[] }>('/admin/plans')
      .then((res) => {
        setPlans(res.data);
        setFromFallback(false);
      })
      .catch(() => {
        setPlans(FALLBACK_PLANS);
        setFromFallback(true);
      })
      .finally(() => setLoading(false));
  }, []);

  const thStyle: React.CSSProperties = {
    textAlign: 'left',
    fontSize: 11,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.35)',
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    padding: '10px 16px',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    whiteSpace: 'nowrap',
  };

  const tdStyle: React.CSSProperties = {
    padding: '14px 16px',
    fontSize: 13,
    color: '#e8e8ee',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    verticalAlign: 'middle',
  };

  return (
    <div style={{ padding: '32px 32px', maxWidth: 1000 }}>
      {/* Page title */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#e8e8ee', margin: 0, marginBottom: 4 }}>플랜 관리</h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', margin: 0 }}>
          {loading
            ? '불러오는 중...'
            : fromFallback
            ? '플랜 API 없음 — 기본값 표시 중 (read-only)'
            : `${plans.length}개 플랜`}
        </p>
      </div>

      {/* ── Plan Cards (summary) ── */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 32 }}>
        {plans.map((plan) => {
          const color = PLAN_COLORS[plan.name] ?? 'rgba(255,255,255,0.35)';
          return (
            <div
              key={plan.id}
              style={{
                flex: '1 1 180px',
                padding: '18px 20px',
                borderRadius: 12,
                background: `${color}0a`,
                border: `1px solid ${color}30`,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                {plan.displayName}
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#e8e8ee', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>
                {plan.priceMonthly === 0 ? '무료' : `$${plan.priceMonthly}`}
                {plan.priceMonthly > 0 && <span style={{ fontSize: 12, fontWeight: 400, color: 'rgba(255,255,255,0.35)' }}>/월</span>}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                SAST {plan.sastMonthlyLimit >= 99999 ? '무제한' : `${plan.sastMonthlyLimit.toLocaleString()}회`}/월
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Detail Table ── */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>플랜</th>
              <th style={thStyle}>가격(월)</th>
              <th style={thStyle}>최대 멤버</th>
              <th style={thStyle}>SAST 한도</th>
              <th style={thStyle}>월 크레딧</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>DAST</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>모니터링</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>API 접근</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ padding: '40px 16px', textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.25)' }}>
                  불러오는 중...
                </td>
              </tr>
            ) : plans.map((plan) => {
              const color = PLAN_COLORS[plan.name] ?? 'rgba(255,255,255,0.35)';
              const isHovered = hoveredRow === plan.id;
              return (
                <tr
                  key={plan.id}
                  onMouseEnter={() => setHoveredRow(plan.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                  style={{ background: isHovered ? 'rgba(255,255,255,0.03)' : 'transparent', transition: 'background 0.1s' }}
                >
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                      <span style={{ fontWeight: 700, color }}>{plan.displayName}</span>
                    </div>
                  </td>
                  <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)' }}>
                    {plan.priceMonthly === 0 ? '무료' : `$${plan.priceMonthly}`}
                  </td>
                  <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)' }}>
                    {plan.maxMembers >= 9999 ? '무제한' : plan.maxMembers}
                  </td>
                  <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)' }}>
                    {plan.sastMonthlyLimit >= 99999 ? '무제한' : plan.sastMonthlyLimit.toLocaleString()}
                  </td>
                  <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)' }}>
                    {plan.creditGrantMonthly.toLocaleString()}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <BoolCell value={plan.allowDast} />
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <BoolCell value={plan.allowMonitoring} />
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <BoolCell value={plan.allowApiAccess} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {fromFallback && (
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', marginTop: 12 }}>
          * GET /api/v1/admin/plans 엔드포인트가 없어 하드코딩 기본값을 표시합니다.
        </p>
      )}
    </div>
  );
}
