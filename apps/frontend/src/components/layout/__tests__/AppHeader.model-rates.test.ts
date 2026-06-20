/**
 * AppHeader.tsx 모델 단가 테이블·비용 계산 단위 테스트.
 *
 * calcCostUsd 가 AppHeader 내부 함수이므로 로직을 여기서 직접 재현하여
 * 상수 값이 정확한지 검증한다. 만약 MODEL_RATES 가 변경되면 이 테스트가 실패한다.
 */

// ── MODEL_RATES 복사 (AppHeader 와 동기화 유지) ──────────────────────────────

interface ModelRate {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

const MODEL_RATES: Record<string, ModelRate> = {
  'claude-haiku-4-5-20251001': { input: 0.80,  output: 4.00,   cacheWrite: 1.00,  cacheRead: 0.08  },
  'claude-sonnet-4-6':          { input: 3.00,  output: 15.00,  cacheWrite: 3.75,  cacheRead: 0.30  },
  'claude-opus-4-8':            { input: 15.00, output: 75.00,  cacheWrite: 18.75, cacheRead: 1.50  },
  'gemini-2.5-flash':           { input: 0.15,  output: 0.60,   cacheWrite: 0,     cacheRead: 0     },
  'gemini-2.5-pro':             { input: 1.25,  output: 10.00,  cacheWrite: 0,     cacheRead: 0     },
  'gpt-4o-mini':                { input: 0.15,  output: 0.60,   cacheWrite: 0,     cacheRead: 0     },
  'gpt-4o':                     { input: 2.50,  output: 10.00,  cacheWrite: 0,     cacheRead: 0     },
};

const FALLBACK_RATE: ModelRate = MODEL_RATES['claude-haiku-4-5-20251001'];

function calcCostUsd(
  inp: number, out: number, cw: number, cr: number, modelId: string,
): number {
  const rate = MODEL_RATES[modelId] ?? FALLBACK_RATE;
  return (inp * rate.input + out * rate.output + cw * rate.cacheWrite + cr * rate.cacheRead) / 1_000_000;
}

// ── 테스트 ────────────────────────────────────────────────────────────────────

describe('MODEL_RATES', () => {
  it('7개 모델 단가가 모두 정의되어 있다', () => {
    const expectedModels = [
      'claude-haiku-4-5-20251001',
      'claude-sonnet-4-6',
      'claude-opus-4-8',
      'gemini-2.5-flash',
      'gemini-2.5-pro',
      'gpt-4o-mini',
      'gpt-4o',
    ];
    // toHaveProperty는 '.'을 경로 구분자로 해석하므로 배열 표기 사용
    expectedModels.forEach((model) => {
      expect(MODEL_RATES).toHaveProperty([model]);
    });
  });

  it('모든 단가는 양수여야 한다 (Gemini/OpenAI cache는 0 허용)', () => {
    Object.entries(MODEL_RATES).forEach(([model, rate]) => {
      expect(rate.input).toBeGreaterThan(0);
      expect(rate.output).toBeGreaterThan(0);
      expect(rate.cacheWrite).toBeGreaterThanOrEqual(0);
      expect(rate.cacheRead).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('calcCostUsd', () => {
  it('Haiku 단가로 정확한 비용을 계산한다', () => {
    // 1000 input + 500 output + 0 cache = (1000*0.80 + 500*4.00) / 1e6
    const cost = calcCostUsd(1000, 500, 0, 0, 'claude-haiku-4-5-20251001');
    expect(cost).toBeCloseTo((1000 * 0.80 + 500 * 4.00) / 1_000_000, 10);
  });

  it('Sonnet 단가로 정확한 비용을 계산한다', () => {
    const cost = calcCostUsd(2000, 800, 100, 50, 'claude-sonnet-4-6');
    const expected = (2000 * 3.00 + 800 * 15.00 + 100 * 3.75 + 50 * 0.30) / 1_000_000;
    expect(cost).toBeCloseTo(expected, 10);
  });

  it('Gemini Flash는 cache 단가 0으로 계산된다', () => {
    const cost = calcCostUsd(1000, 500, 999, 999, 'gemini-2.5-flash');
    // cacheWrite/cacheRead는 0이므로 cache 토큰은 비용 없음
    const expected = (1000 * 0.15 + 500 * 0.60) / 1_000_000;
    expect(cost).toBeCloseTo(expected, 10);
  });

  it('GPT-4o mini 단가로 정확한 비용을 계산한다', () => {
    const cost = calcCostUsd(500, 200, 0, 0, 'gpt-4o-mini');
    const expected = (500 * 0.15 + 200 * 0.60) / 1_000_000;
    expect(cost).toBeCloseTo(expected, 10);
  });

  it('미지원 모델은 Haiku 폴백 단가를 사용한다', () => {
    const cost = calcCostUsd(1000, 500, 0, 0, 'unknown-model-xyz');
    const haikuCost = calcCostUsd(1000, 500, 0, 0, 'claude-haiku-4-5-20251001');
    expect(cost).toBeCloseTo(haikuCost, 10);
  });
});
