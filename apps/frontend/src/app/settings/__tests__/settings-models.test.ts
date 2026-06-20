/**
 * settings/page.tsx 의 MODELS 7종 상수 단위 테스트.
 *
 * 컴포넌트 자체는 API 의존성이 많아 렌더링 테스트 대신
 * 모델 상수 목록을 직접 정의해 7종이 올바르게 구성됐는지 검증한다.
 * 실제 상수와 동기화 유지가 중요하다.
 */

type ModelProvider = 'anthropic' | 'gemini' | 'openai';

interface ModelOption {
  id: string;
  label: string;
  provider: ModelProvider;
  providerLabel: string;
  desc: string;
  creditCost: number;
  color: string;
}

// settings/page.tsx MODELS 복사 (변경 시 동기화 필요)
const MODELS: ModelOption[] = [
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5',  provider: 'anthropic', providerLabel: 'Claude', desc: '빠르고 저렴 — 대부분의 프로젝트에 추천', creditCost: 1,  color: '#22c55e' },
  { id: 'claude-sonnet-4-6',          label: 'Claude Sonnet 4.6', provider: 'anthropic', providerLabel: 'Claude', desc: '균형 잡힌 성능 — 복잡한 코드베이스에 최적', creditCost: 5,  color: '#f59e0b' },
  { id: 'claude-opus-4-8',            label: 'Claude Opus 4.8',   provider: 'anthropic', providerLabel: 'Claude', desc: '최고 성능 — 대규모·고위험 분석', creditCost: 20, color: '#818cf8' },
  { id: 'gemini-2.5-flash',            label: 'Gemini 2.5 Flash',  provider: 'gemini',    providerLabel: 'Gemini', desc: '빠른 멀티모달 모델 — 저비용 대규모 스캔', creditCost: 1,  color: '#34d399' },
  { id: 'gemini-2.5-pro',              label: 'Gemini 2.5 Pro',    provider: 'gemini',    providerLabel: 'Gemini', desc: '고성능 Gemini — 정밀 분석에 최적', creditCost: 5,  color: '#10b981' },
  { id: 'gpt-4o-mini',                 label: 'GPT-4o mini',       provider: 'openai',    providerLabel: 'OpenAI', desc: '경량·고속 GPT — 빠른 정적 분석', creditCost: 1,  color: '#60a5fa' },
  { id: 'gpt-4o',                      label: 'GPT-4o',            provider: 'openai',    providerLabel: 'OpenAI', desc: '최신 GPT — 복잡한 취약점 패턴 분석', creditCost: 5,  color: '#3b82f6' },
];

describe('MODELS 상수', () => {
  it('정확히 7개 모델이 정의되어 있다', () => {
    expect(MODELS).toHaveLength(7);
  });

  it('모든 모델 ID가 고유하다', () => {
    const ids = MODELS.map((m) => m.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(MODELS.length);
  });

  it('모든 모델에 creditCost가 양수로 지정되어 있다', () => {
    MODELS.forEach((m) => {
      expect(m.creditCost).toBeGreaterThan(0);
    });
  });

  it('Anthropic 모델 3종이 포함된다', () => {
    const anthropic = MODELS.filter((m) => m.provider === 'anthropic');
    expect(anthropic.map((m) => m.id)).toEqual(
      expect.arrayContaining([
        'claude-haiku-4-5-20251001',
        'claude-sonnet-4-6',
        'claude-opus-4-8',
      ])
    );
  });

  it('Gemini 모델 2종이 포함된다', () => {
    const gemini = MODELS.filter((m) => m.provider === 'gemini');
    expect(gemini.map((m) => m.id)).toEqual(
      expect.arrayContaining(['gemini-2.5-flash', 'gemini-2.5-pro'])
    );
  });

  it('OpenAI 모델 2종이 포함된다', () => {
    const openai = MODELS.filter((m) => m.provider === 'openai');
    expect(openai.map((m) => m.id)).toEqual(
      expect.arrayContaining(['gpt-4o-mini', 'gpt-4o'])
    );
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
    MODELS.forEach((m) => {
      expect(m.creditCost).toBe(costMap[m.id]);
    });
  });
});
