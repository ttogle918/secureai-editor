// ============================================================
// Kkebi — AI 모델 메타데이터 단일 진실원천 (FE)
// 설정 화면(모델 선택 UI)과 AppHeader(분석완료 비용 표시)가 공유한다.
// 백엔드 ModelConstants.java(VALID_MODELS·CREDIT_COST_PER_FILE)와 동기 유지.
// ============================================================

export type ModelProvider = 'anthropic' | 'gemini' | 'openai';

/** 미설정/엔진 폴백 시 사용할 기본 모델 ID */
export const DEFAULT_MODEL_ID = 'claude-haiku-4-5-20251001';

export interface ModelOption {
  id: string;
  label: string;
  provider: ModelProvider;
  providerLabel: string;
  desc: string;
  creditCost: number;
  color: string;
}

export const MODELS: ModelOption[] = [
  // ── Anthropic (Claude) ─────────────────────────────────────────────────────
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5',  provider: 'anthropic', providerLabel: 'Claude', desc: '빠르고 저렴 — 대부분의 프로젝트에 추천', creditCost: 1,  color: '#22c55e' },
  { id: 'claude-sonnet-4-6',          label: 'Claude Sonnet 4.6', provider: 'anthropic', providerLabel: 'Claude', desc: '균형 잡힌 성능 — 복잡한 코드베이스에 최적', creditCost: 5,  color: '#f59e0b' },
  { id: 'claude-opus-4-8',            label: 'Claude Opus 4.8',   provider: 'anthropic', providerLabel: 'Claude', desc: '최고 성능 — 대규모·고위험 분석', creditCost: 20, color: '#818cf8' },
  // ── Google Gemini ──────────────────────────────────────────────────────────
  { id: 'gemini-2.5-flash',            label: 'Gemini 2.5 Flash',  provider: 'gemini',    providerLabel: 'Gemini', desc: '빠른 멀티모달 모델 — 저비용 대규모 스캔', creditCost: 1,  color: '#34d399' },
  { id: 'gemini-2.5-pro',              label: 'Gemini 2.5 Pro',    provider: 'gemini',    providerLabel: 'Gemini', desc: '고성능 Gemini — 정밀 분석에 최적', creditCost: 5,  color: '#10b981' },
  // ── OpenAI ─────────────────────────────────────────────────────────────────
  { id: 'gpt-4o-mini',                 label: 'GPT-4o mini',       provider: 'openai',    providerLabel: 'OpenAI', desc: '경량·고속 GPT — 빠른 정적 분석', creditCost: 1,  color: '#60a5fa' },
  { id: 'gpt-4o',                      label: 'GPT-4o',            provider: 'openai',    providerLabel: 'OpenAI', desc: '최신 GPT — 복잡한 취약점 패턴 분석', creditCost: 5,  color: '#3b82f6' },
];

/** provider별 모델 그룹 렌더링 순서 */
export const MODEL_PROVIDER_ORDER: ModelProvider[] = ['anthropic', 'gemini', 'openai'];

export const PROVIDER_GROUP_LABELS: Record<ModelProvider, string> = {
  anthropic: 'Claude (Anthropic)',
  gemini:    'Gemini (Google)',
  openai:    'GPT (OpenAI)',
};

// ── 토큰 단가 (USD per 1M tokens) ────────────────────────────────────────────
// 표시용 추정치 — 권위 비용 기록은 백엔드 token_usage 를 참조한다.
// cacheWrite / cacheRead 는 Anthropic 전용. Gemini/OpenAI 는 0으로 처리.
export interface ModelRate {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

export const MODEL_RATES: Record<string, ModelRate> = {
  'claude-haiku-4-5-20251001': { input: 0.80,  output: 4.00,   cacheWrite: 1.00,  cacheRead: 0.08  },
  'claude-sonnet-4-6':          { input: 3.00,  output: 15.00,  cacheWrite: 3.75,  cacheRead: 0.30  },
  'claude-opus-4-8':            { input: 15.00, output: 75.00,  cacheWrite: 18.75, cacheRead: 1.50  },
  'gemini-2.5-flash':           { input: 0.15,  output: 0.60,   cacheWrite: 0,     cacheRead: 0     },
  'gemini-2.5-pro':             { input: 1.25,  output: 10.00,  cacheWrite: 0,     cacheRead: 0     },
  'gpt-4o-mini':                { input: 0.15,  output: 0.60,   cacheWrite: 0,     cacheRead: 0     },
  'gpt-4o':                     { input: 2.50,  output: 10.00,  cacheWrite: 0,     cacheRead: 0     },
};

/** 미지원 모델 단가 폴백 — 기본 모델(Haiku) 단가 사용 */
export const FALLBACK_RATE: ModelRate = MODEL_RATES[DEFAULT_MODEL_ID];

/** 토큰 사용량과 모델 ID로 표시용 추정 비용(USD)을 계산한다. */
export function calcCostUsd(
  inp: number, out: number, cw: number, cr: number, modelId: string,
): number {
  const rate = MODEL_RATES[modelId] ?? FALLBACK_RATE;
  return (inp * rate.input + out * rate.output + cw * rate.cacheWrite + cr * rate.cacheRead) / 1_000_000;
}
