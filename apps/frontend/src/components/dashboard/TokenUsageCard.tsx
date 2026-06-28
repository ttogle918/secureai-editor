'use client';
import { MODEL_RATES, FALLBACK_RATE } from '@/lib/constants/models';

/** 표시용 USD→KRW 환산 환율(대략치). 권위 비용은 백엔드 token_usage(USD)를 따른다. */
const USD_TO_KRW = 1380;

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  estimatedCostUsd: number;
  modelId: string;
}

/**
 * 분석 토큰 사용량 카드.
 * 단가 푸터는 하드코딩이 아니라 모델별 실단가(MODEL_RATES[modelId])를 사용한다.
 * 캐시 단가가 0인 모델(Gemini/OpenAI)은 캐시 단가 표기를 생략한다.
 */
export function TokenUsageCard({ usage }: { usage: TokenUsage }) {
  const rate = MODEL_RATES[usage.modelId] ?? FALLBACK_RATE;

  const totalTokens =
    usage.inputTokens + usage.outputTokens + usage.cacheWriteTokens + usage.cacheReadTokens;

  const breakdown = [
    { label: '입력',      value: usage.inputTokens,      color: 'var(--tag-5)' },
    { label: '출력',      value: usage.outputTokens,     color: 'var(--tag-3)' },
    { label: '캐시 쓰기', value: usage.cacheWriteTokens, color: 'var(--high)' },
    { label: '캐시 읽기', value: usage.cacheReadTokens,  color: 'var(--tag-6)' },
  ] as const;

  const hasCacheRate = rate.cacheWrite > 0 || rate.cacheRead > 0;
  const rateFooter =
    `입력 $${rate.input} / 출력 $${rate.output}` +
    (hasCacheRate ? ` / 캐시쓰기 $${rate.cacheWrite} / 캐시읽기 $${rate.cacheRead}` : '') +
    ' (per MTok)';

  return (
    <div style={{
      background: 'var(--bg-2)', border: '1px solid var(--border)',
      borderRadius: 8, padding: '16px 20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>토큰 사용량</span>
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 3,
            background: 'rgba(99,102,241,0.12)', color: 'var(--tag-1)',
            border: '0.5px solid rgba(99,102,241,0.25)',
          }}>
            {usage.modelId}
          </span>
        </div>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
          ${usage.estimatedCostUsd.toFixed(4)}
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 6 }}>
            (≈ ₩{Math.round(usage.estimatedCostUsd * USD_TO_KRW).toLocaleString()})
          </span>
        </span>
      </div>
      <div style={{
        marginTop: 12, display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
      }}>
        {breakdown.map(({ label, value, color }) => (
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
        총 {totalTokens.toLocaleString()} 토큰 · 가격 기준: {rateFooter}
      </div>
    </div>
  );
}
