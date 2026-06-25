'use client';
// 크레딧 충전(구매) 페이지 — 과금 모드 2종 안내 + 크레딧 패키지.
// ⚠️ 결제 게이트웨이(PG) 미연동: "구매 가능"을 보여주는 단계. 실제 결제는 FEAT-BILLING-1.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Coins, Check, Key, CreditCard, ArrowLeft } from 'lucide-react';
import { useCredits } from '@/hooks/useCredits';
import { ToastContainer } from '@/components/ui/Toast';
import { useToastStore } from '@/hooks/useToast';

interface CreditPack {
  id: string;
  name: string;
  credits: number;
  priceKrw: number;
  popular?: boolean;
}

// 예시 패키지 — 실제 단가는 PG 연동(FEAT-BILLING-1) 시 확정.
const CREDIT_PACKS: CreditPack[] = [
  { id: 'starter', name: '스타터',     credits: 5_000,   priceKrw: 9_900 },
  { id: 'pro',     name: '프로',       credits: 30_000,  priceKrw: 49_000, popular: true },
  { id: 'team',    name: '팀',         credits: 120_000, priceKrw: 149_000 },
];

const ACCENT = '#f97316';

export default function BillingPage() {
  const router = useRouter();
  const { data: credits } = useCredits();
  const addToast = useToastStore((s) => s.addToast);
  const [selected, setSelected] = useState<string>('pro');

  const onPurchase = (pack: CreditPack) => {
    // PG 미연동 — 결제 의사만 안내(FEAT-BILLING-1에서 실제 연동)
    addToast(`'${pack.name}' 결제 연동은 준비 중입니다 (곧 제공). 현재는 가입·플랜 크레딧으로 이용하세요.`, 'info');
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-1)', color: 'var(--text-primary)', padding: '32px 24px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        {/* 헤더 */}
        <button
          onClick={() => router.back()}
          aria-label="뒤로"
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 12, marginBottom: 16 }}
        >
          <ArrowLeft size={14} /> 뒤로
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Coins size={24} color={ACCENT} aria-hidden="true" />
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>크레딧 충전</h1>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 8 }}>
          크레딧으로 플랫폼 키를 통해 분석을 실행합니다. 직접 API 키를 등록하면(BYOK) 크레딧 차감 없이 무제한 사용할 수 있습니다.
        </p>

        {/* 현재 잔액 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 10, background: 'var(--bg-2)', border: '1px solid var(--border)', marginBottom: 24 }}>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>현재 잔액</span>
          <span style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)', color: ACCENT }}>
            {credits ? `${credits.balance.toLocaleString()} cr` : '— cr'}
          </span>
          {credits?.plan?.displayName && (
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'rgba(249,115,22,0.12)', color: ACCENT, fontFamily: 'var(--font-mono)' }}>
              {credits.plan.displayName}
            </span>
          )}
        </div>

        {/* 과금 모드 2종 안내 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 28 }}>
          <div style={{ padding: 16, borderRadius: 10, background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Key size={16} color="#22c55e" aria-hidden="true" />
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>① 내 키 사용 (BYOK)</h3>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              Claude·Gemini·OpenAI 키를 직접 등록하면 그 키로 호출됩니다. <b>크레딧 차감 없음 · 사용 한도 없음.</b> 요금은 각 프로바이더에 직접 청구됩니다.
            </p>
            <button
              onClick={() => router.push('/settings')}
              style={{ marginTop: 12, fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 6, background: 'transparent', border: '1px solid rgba(34,197,94,0.4)', color: '#22c55e', cursor: 'pointer' }}
            >
              설정에서 키 등록 →
            </button>
          </div>
          <div style={{ padding: 16, borderRadius: 10, background: 'var(--bg-2)', border: `1px solid ${ACCENT}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <CreditCard size={16} color={ACCENT} aria-hidden="true" />
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>② 크레딧 사용 (충전식)</h3>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              키 관리 없이 <b>크레딧만 충전</b>하면 플랫폼 키로 각 모델을 실행합니다. 사용량만큼 크레딧이 차감되고, 소진 시 충전하면 됩니다.
            </p>
          </div>
        </div>

        {/* 크레딧 패키지 */}
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>크레딧 패키지</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
          {CREDIT_PACKS.map((pack) => {
            const isSel = selected === pack.id;
            return (
              <div
                key={pack.id}
                onClick={() => setSelected(pack.id)}
                role="button"
                tabIndex={0}
                aria-pressed={isSel}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(pack.id); } }}
                style={{
                  position: 'relative', padding: 18, borderRadius: 12, cursor: 'pointer',
                  background: isSel ? 'var(--orange-dim)' : 'var(--bg-2)',
                  border: `1px solid ${isSel ? ACCENT : 'var(--border)'}`,
                  transition: 'border-color .12s, background .12s',
                }}
              >
                {pack.popular && (
                  <span style={{ position: 'absolute', top: -9, right: 14, fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: ACCENT, color: '#fff' }}>인기</span>
                )}
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{pack.name}</div>
                <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-mono)', color: ACCENT }}>
                  {pack.credits.toLocaleString()}<span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}> cr</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>₩{pack.priceKrw.toLocaleString()}</div>
                {isSel && <Check size={16} color={ACCENT} style={{ position: 'absolute', bottom: 14, right: 14 }} aria-hidden="true" />}
              </div>
            );
          })}
        </div>

        {/* 구매 버튼 (PG 미연동) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => { const p = CREDIT_PACKS.find((x) => x.id === selected); if (p) onPurchase(p); }}
            style={{ fontSize: 14, fontWeight: 700, padding: '10px 22px', borderRadius: 8, background: ACCENT, border: 'none', color: '#fff', cursor: 'pointer', boxShadow: 'var(--orange-shadow)' }}
          >
            구매하기
          </button>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            * 결제 연동은 준비 중입니다(곧 제공). 현재 크레딧은 가입 보너스·플랜 지급으로 충전됩니다.
          </span>
        </div>
      </div>
      <ToastContainer />
    </div>
  );
}
