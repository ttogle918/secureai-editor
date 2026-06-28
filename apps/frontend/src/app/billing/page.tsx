'use client';
// 크레딧 충전 + 요금제 + 사용량 페이지.
// ⚠️ 결제 게이트웨이(PG) 미연동: "구매/업그레이드 가능"을 보여주는 단계. 실제 결제는 FEAT-BILLING-1.
//    사용량 그래프는 데모용 더미 데이터(라벨에 명시).
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Coins, Check, Key, CreditCard, ArrowLeft, X, BarChart3 } from 'lucide-react';
import { useCredits } from '@/hooks/useCredits';
import { ToastContainer } from '@/components/ui/Toast';
import { useToastStore } from '@/hooks/useToast';

const ACCENT = '#f97316';

// ── 크레딧 패키지 (예시 단가 — PG 연동 시 확정) ──
// 프로/팀 팩은 요금제 티어(Pro $29·3,000cr / Team $39·4,500cr)와 가격·크레딧을 일치시킨다.
// (동일 명칭이 서로 다른 값을 갖던 불일치 수정)
interface CreditPack { id: string; name: string; credits: number; priceUsd: number; popular?: boolean; }
const CREDIT_PACKS: CreditPack[] = [
  { id: 'starter', name: '스타터', credits: 1_000, priceUsd: 9 },
  { id: 'pro', name: '프로', credits: 3_000, priceUsd: 29, popular: true },
  { id: 'team', name: '팀', credits: 4_500, priceUsd: 39 },
];

// ── 요금제 티어 ──
interface Tier { id: string; name: string; price: string; period?: string; features: string[]; cta: string; highlight?: boolean; }
const TIERS: Tier[] = [
  {
    id: 'free', name: 'Free', price: '$0', period: '/mo',
    features: ['월 100 크레딧', 'SAST 분석', 'GitHub 스캔', 'BYOK 지원'], cta: '현재 플랜'
  },
  {
    id: 'pro', name: 'Pro', price: '$29', period: '/mo', highlight: true,
    features: ['월 3,000 크레딧', 'SAST + DAST 증명', '자동 패치 PR', '컴플라이언스 리포트·SBOM', '우선 지원'], cta: '업그레이드'
  },
  {
    id: 'team', name: 'Team', price: '$39', period: '/인·월',
    features: ['인당 월 4,500 크레딧', '시트 무제한 · 인당 과금', '팀 멤버·역할 관리', '팀 대시보드 · 트리아지 공유', '야간 자동 모니터링'], cta: '업그레이드'
  },
  {
    id: 'enterprise', name: 'Enterprise', price: 'Custom',
    features: ['무제한 크레딧/시트', 'SSO·감사로그·IP 허용목록', '온프레미스/폐쇄망 배포', 'SLA·전담 지원', '원화 결제·세금계산서'], cta: '영업팀 문의'
  },
];

// ── 사용량 더미 데이터 (이번 주) ──
const WEEK_USAGE = [
  { d: '월', tokens: 12_400 }, { d: '화', tokens: 8_900 }, { d: '수', tokens: 21_300 },
  { d: '목', tokens: 15_700 }, { d: '금', tokens: 28_100 }, { d: '토', tokens: 4_200 }, { d: '일', tokens: 9_800 },
];
const COST_PER_1K = 0.003; // 데모용 환산 단가($/1k tokens)

export default function BillingPage() {
  const router = useRouter();
  const { data: credits } = useCredits();
  const addToast = useToastStore((s) => s.addToast);
  const [selected, setSelected] = useState('pro');
  const [contactOpen, setContactOpen] = useState(false);
  // FEAT-BILLING-2: 분석 시 키 모드 선택(AUTO/BYOK/PLATFORM) — localStorage 저장, useStartAnalysis가 읽어 전달.
  const [keyMode, setKeyMode] = useState<string>(() => (typeof window !== 'undefined' ? localStorage.getItem('keyMode') ?? 'AUTO' : 'AUTO'));
  const changeKeyMode = (m: string) => {
    setKeyMode(m);
    if (typeof window !== 'undefined') localStorage.setItem('keyMode', m);
    const label = m === 'BYOK' ? '내 키(BYOK)' : m === 'PLATFORM' ? '크레딧(플랫폼 키)' : '자동';
    addToast(`분석 키 모드: ${label}`, 'info');
  };
  const KEY_MODES: { id: string; label: string }[] = [
    { id: 'AUTO', label: '자동' },
    { id: 'BYOK', label: '내 키(BYOK)' },
    { id: 'PLATFORM', label: '크레딧' },
  ];

  const maxTok = Math.max(...WEEK_USAGE.map((x) => x.tokens));
  const weekTotal = WEEK_USAGE.reduce((a, b) => a + b.tokens, 0);
  const weekCost = (weekTotal / 1000) * COST_PER_1K;

  const onPurchase = (label: string) =>
    addToast(`'${label}' 결제 연동은 준비 중입니다 (곧 제공).`, 'info');

  const onTierCta = (t: Tier) => {
    if (t.id === 'free') return;
    if (t.id === 'enterprise') { setContactOpen(true); return; }
    onPurchase(`${t.name} 플랜`);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-1)', color: 'var(--text-primary)', padding: '32px 24px' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <button onClick={() => router.back()} aria-label="뒤로"
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 12, marginBottom: 16 }}>
          <ArrowLeft size={14} /> 뒤로
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Coins size={24} color={ACCENT} aria-hidden="true" />
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>요금제 & 크레딧</h1>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20 }}>
          크레딧으로 플랫폼 키를 통해 분석을 실행합니다. 직접 API 키를 등록하면(BYOK) 크레딧 차감 없이 무제한 사용할 수 있습니다.
        </p>

        {/* 현재 잔액 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 10, background: 'var(--bg-2)', border: '1px solid var(--border)', marginBottom: 28 }}>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>현재 잔액</span>
          <span style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)', color: ACCENT }}>
            {credits ? `${credits.balance.toLocaleString()} cr` : '— cr'}
          </span>
          {credits?.plan?.displayName && (
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'rgba(249,115,22,0.12)', color: ACCENT, fontFamily: 'var(--font-mono)' }}>{credits.plan.displayName}</span>
          )}
        </div>

        {/* ── 요금제 카드 (4단) ── */}
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>요금제</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 32 }}>
          {TIERS.map((t) => (
            <div key={t.id} style={{
              position: 'relative', padding: 20, borderRadius: 12,
              background: t.highlight ? 'var(--orange-dim)' : 'var(--bg-2)',
              border: `1px solid ${t.highlight ? ACCENT : 'var(--border)'}`,
              display: 'flex', flexDirection: 'column', gap: 12,
            }}>
              {t.highlight && <span style={{ position: 'absolute', top: -9, left: 20, fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: ACCENT, color: '#fff' }}>추천</span>}
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{t.name}</div>
                <div style={{ marginTop: 4 }}>
                  <span style={{ fontSize: 26, fontWeight: 800, fontFamily: 'var(--font-mono)' }}>{t.price}</span>
                  {t.period && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{t.period}</span>}
                </div>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 7, flex: 1 }}>
                {t.features.map((f) => (
                  <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--text-secondary)' }}>
                    <Check size={13} color={t.highlight ? ACCENT : '#22c55e'} aria-hidden="true" /> {f}
                  </li>
                ))}
              </ul>
              <button onClick={() => onTierCta(t)} disabled={t.id === 'free'}
                style={{
                  fontSize: 13, fontWeight: 700, padding: '9px 0', borderRadius: 7, width: '100%',
                  background: t.highlight ? ACCENT : 'transparent',
                  border: `1px solid ${t.highlight ? ACCENT : 'var(--border-2)'}`,
                  color: t.highlight ? '#fff' : (t.id === 'free' ? 'var(--text-tertiary)' : 'var(--text-primary)'),
                  cursor: t.id === 'free' ? 'default' : 'pointer',
                }}>
                {t.cta}
              </button>
            </div>
          ))}
        </div>

        {/* ── 사용량 그래프 (이번 주, 더미) ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <BarChart3 size={16} color={ACCENT} aria-hidden="true" />
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>이번 주 사용량</h2>
          <span style={{ fontSize: 10, color: 'var(--text-disabled)' }}>(데모 데이터)</span>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
            {(weekTotal / 1000).toFixed(1)}k tokens · ${weekCost.toFixed(2)}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 140, padding: '12px 16px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 32 }}>
          {WEEK_USAGE.map((x) => (
            <div key={x.d} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
              <span style={{ fontSize: 9, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{(x.tokens / 1000).toFixed(1)}k</span>
              <div title={`${x.d}: ${x.tokens.toLocaleString()} tokens`}
                style={{ width: '100%', maxWidth: 36, height: `${(x.tokens / maxTok) * 100}%`, background: `linear-gradient(180deg, ${ACCENT}, var(--orange-2))`, borderRadius: '4px 4px 0 0', minHeight: 4 }} />
              <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{x.d}</span>
            </div>
          ))}
        </div>

        {/* ── 과금 모드 2종 ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 32 }}>
          <div style={{ padding: 16, borderRadius: 10, background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Key size={16} color="#22c55e" aria-hidden="true" />
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>① 내 키 사용 (BYOK)</h3>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              Claude·Gemini·OpenAI 키를 직접 등록하면 그 키로 호출됩니다. <b>크레딧 차감 없음 · 한도 없음.</b>
            </p>
            <button onClick={() => router.push('/settings')}
              style={{ marginTop: 12, fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 6, background: 'transparent', border: '1px solid rgba(34,197,94,0.4)', color: '#22c55e', cursor: 'pointer' }}>
              설정에서 키 등록 →
            </button>
          </div>
          <div style={{ padding: 16, borderRadius: 10, background: 'var(--bg-2)', border: `1px solid ${ACCENT}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <CreditCard size={16} color={ACCENT} aria-hidden="true" />
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>② 크레딧 사용 (충전식)</h3>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              키 관리 없이 <b>크레딧만 충전</b>하면 플랫폼 키로 각 모델을 실행합니다. 사용량만큼 차감됩니다.
            </p>
          </div>
        </div>

        {/* ── 분석 키 모드 선택 (FEAT-BILLING-2) ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 10, background: 'var(--bg-2)', border: '1px solid var(--border)', marginBottom: 32 }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>분석 시 키 모드</span>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>자동 = 내 키 있으면 BYOK, 없으면 크레딧</span>
          <div style={{ flex: 1 }} />
          <div role="radiogroup" aria-label="키 모드" style={{ display: 'flex', gap: 4, background: 'var(--bg-3)', padding: 3, borderRadius: 8 }}>
            {KEY_MODES.map((m) => {
              const on = keyMode === m.id;
              return (
                <button key={m.id} role="radio" aria-checked={on} onClick={() => changeKeyMode(m.id)}
                  style={{
                    fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 6, cursor: 'pointer', border: 'none',
                    background: on ? ACCENT : 'transparent', color: on ? '#fff' : 'var(--text-secondary)'
                  }}>
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── 크레딧 패키지 ── */}
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>크레딧 패키지</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 18 }}>
          {CREDIT_PACKS.map((pack) => {
            const isSel = selected === pack.id;
            return (
              <div key={pack.id} onClick={() => setSelected(pack.id)} role="button" tabIndex={0} aria-pressed={isSel}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(pack.id); } }}
                style={{
                  position: 'relative', padding: 18, borderRadius: 12, cursor: 'pointer',
                  background: isSel ? 'var(--orange-dim)' : 'var(--bg-2)', border: `1px solid ${isSel ? ACCENT : 'var(--border)'}`
                }}>
                {pack.popular && <span style={{ position: 'absolute', top: -9, right: 14, fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: ACCENT, color: '#fff' }}>인기</span>}
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{pack.name}</div>
                <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-mono)', color: ACCENT }}>
                  {pack.credits.toLocaleString()}<span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}> cr</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>${pack.priceUsd}</div>
                {isSel && <Check size={16} color={ACCENT} style={{ position: 'absolute', bottom: 14, right: 14 }} aria-hidden="true" />}
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => { const p = CREDIT_PACKS.find((x) => x.id === selected); if (p) onPurchase(`${p.name} 패키지`); }}
            style={{ fontSize: 14, fontWeight: 700, padding: '10px 22px', borderRadius: 8, background: ACCENT, border: 'none', color: '#fff', cursor: 'pointer', boxShadow: 'var(--orange-shadow)' }}>
            구매하기
          </button>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>* 결제 연동은 준비 중입니다(곧 제공). 현재 크레딧은 가입 보너스·플랜 지급으로 충전됩니다.</span>
        </div>
      </div>

      {/* ── Enterprise 문의 모달 ── */}
      {contactOpen && (
        <div role="dialog" aria-modal="true" aria-label="Enterprise 문의"
          onClick={() => setContactOpen(false)}
          onKeyDown={(e) => { if (e.key === 'Escape') setContactOpen(false); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ width: 'min(420px, 90vw)', padding: 24, borderRadius: 12, background: 'var(--bg-2)', border: `1px solid ${ACCENT}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Enterprise 문의</h3>
              <button onClick={() => setContactOpen(false)} aria-label="닫기" style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
              Enterprise 플랜·결제 연동은 영업팀에 문의해 주세요. SSO·온프레미스·SLA를 포함한 맞춤 견적을 안내드립니다.
            </p>
            <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 8, background: 'var(--bg-3)', fontFamily: 'var(--font-mono)', fontSize: 13, color: ACCENT }}>
              sales@secureai.example
            </div>
            <button onClick={() => setContactOpen(false)}
              style={{ marginTop: 16, width: '100%', fontSize: 13, fontWeight: 700, padding: '9px 0', borderRadius: 7, background: ACCENT, border: 'none', color: '#fff', cursor: 'pointer' }}>
              확인
            </button>
          </div>
        </div>
      )}
      <ToastContainer />
    </div>
  );
}
