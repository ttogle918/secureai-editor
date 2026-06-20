/**
 * lib/constants/models.ts — AI 모델 메타데이터 단일 진실원천 단위 테스트.
 * 실제 export 상수를 import 해 검증한다(복사본 동기화 부채 제거).
 */
import {
  MODELS,
  MODEL_RATES,
  MODEL_PROVIDER_ORDER,
  PROVIDER_GROUP_LABELS,
  DEFAULT_MODEL_ID,
  calcCostUsd,
} from '../models';

describe('MODELS 상수', () => {
  it('정확히 7개 모델이 정의되어 있다', () => {
    expect(MODELS).toHaveLength(7);
  });

  it('모든 모델 ID가 고유하다', () => {
    const ids = MODELS.map((m) => m.id);
    expect(new Set(ids).size).toBe(MODELS.length);
  });

  it('모든 모델에 creditCost가 양수로 지정되어 있다', () => {
    MODELS.forEach((m) => expect(m.creditCost).toBeGreaterThan(0));
  });

  it('Anthropic 모델 3종이 포함된다', () => {
    const ids = MODELS.filter((m) => m.provider === 'anthropic').map((m) => m.id);
    expect(ids).toEqual(
      expect.arrayContaining(['claude-haiku-4-5-20251001', 'claude-sonnet-4-6', 'claude-opus-4-8']),
    );
  });

  it('Gemini 모델 2종이 포함된다', () => {
    const ids = MODELS.filter((m) => m.provider === 'gemini').map((m) => m.id);
    expect(ids).toEqual(expect.arrayContaining(['gemini-2.5-flash', 'gemini-2.5-pro']));
  });

  it('OpenAI 모델 2종이 포함된다', () => {
    const ids = MODELS.filter((m) => m.provider === 'openai').map((m) => m.id);
    expect(ids).toEqual(expect.arrayContaining(['gpt-4o-mini', 'gpt-4o']));
  });

  it('claude-opus-4-8 가 포함되고 4-7 은 없다', () => {
    const ids = MODELS.map((m) => m.id);
    expect(ids).toContain('claude-opus-4-8');
    expect(ids).not.toContain('claude-opus-4-7');
  });

  it('크레딧 비용이 명세대로다 (haiku/flash/mini=1, sonnet/pro/4o=5, opus=20)', () => {
    const costMap: Record<string, number> = {
      'claude-haiku-4-5-20251001': 1,
      'claude-sonnet-4-6': 5,
      'claude-opus-4-8': 20,
      'gemini-2.5-flash': 1,
      'gemini-2.5-pro': 5,
      'gpt-4o-mini': 1,
      'gpt-4o': 5,
    };
    MODELS.forEach((m) => expect(m.creditCost).toBe(costMap[m.id]));
  });

  it('DEFAULT_MODEL_ID 가 MODELS 에 존재한다', () => {
    expect(MODELS.map((m) => m.id)).toContain(DEFAULT_MODEL_ID);
  });

  it('모든 모델 provider 가 MODEL_PROVIDER_ORDER / PROVIDER_GROUP_LABELS 에 매핑된다', () => {
    MODELS.forEach((m) => {
      expect(MODEL_PROVIDER_ORDER).toContain(m.provider);
      expect(PROVIDER_GROUP_LABELS[m.provider]).toBeTruthy();
    });
  });
});

describe('MODEL_RATES', () => {
  it('MODELS 7종 전부 단가가 정의되어 있다', () => {
    MODELS.forEach((m) => expect(MODEL_RATES).toHaveProperty([m.id]));
  });

  it('input/output 단가는 양수, cache 단가는 0 이상이다', () => {
    Object.values(MODEL_RATES).forEach((rate) => {
      expect(rate.input).toBeGreaterThan(0);
      expect(rate.output).toBeGreaterThan(0);
      expect(rate.cacheWrite).toBeGreaterThanOrEqual(0);
      expect(rate.cacheRead).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('calcCostUsd', () => {
  it('Haiku 단가로 정확한 비용을 계산한다', () => {
    const cost = calcCostUsd(1000, 500, 0, 0, 'claude-haiku-4-5-20251001');
    expect(cost).toBeCloseTo((1000 * 0.80 + 500 * 4.00) / 1_000_000, 10);
  });

  it('Sonnet 단가로 cache 토큰까지 계산한다', () => {
    const cost = calcCostUsd(2000, 800, 100, 50, 'claude-sonnet-4-6');
    const expected = (2000 * 3.00 + 800 * 15.00 + 100 * 3.75 + 50 * 0.30) / 1_000_000;
    expect(cost).toBeCloseTo(expected, 10);
  });

  it('Gemini Flash는 cache 단가 0으로 계산된다', () => {
    const cost = calcCostUsd(1000, 500, 999, 999, 'gemini-2.5-flash');
    expect(cost).toBeCloseTo((1000 * 0.15 + 500 * 0.60) / 1_000_000, 10);
  });

  it('미지원 모델은 기본 모델 폴백 단가를 사용한다', () => {
    const cost = calcCostUsd(1000, 500, 0, 0, 'unknown-model-xyz');
    const fallback = calcCostUsd(1000, 500, 0, 0, DEFAULT_MODEL_ID);
    expect(cost).toBeCloseTo(fallback, 10);
  });
});
