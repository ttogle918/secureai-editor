'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Key, Cpu, CreditCard, Eye, EyeOff, Check, Trash2 } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { apiClient } from '@/lib/api/client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CreditSummary {
  balance: number;
  hasByok: boolean;
  preferredModel: string;
  modelCosts: Record<string, number>;
}

const MODELS = [
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku', tier: 'haiku', desc: '빠르고 저렴 — 대부분의 프로젝트에 추천', creditCost: 1, color: '#22c55e' },
  { id: 'claude-sonnet-4-6',          label: 'Claude Sonnet', tier: 'sonnet', desc: '균형 잡힌 성능 — 복잡한 코드베이스에 최적', creditCost: 5, color: '#f59e0b' },
  { id: 'claude-opus-4-7',            label: 'Claude Opus',   tier: 'opus',   desc: '최고 성능 — 대규모·고위험 분석', creditCost: 20, color: '#818cf8' },
] as const;

// ── Component ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const router = useRouter();
  const { user, isInitialized } = useAuthStore();

  const [credits, setCredits] = useState<CreditSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState<'idle' | 'saving' | 'saved' | 'removing' | 'error'>('idle');
  const [keyError, setKeyError] = useState('');

  const [selectedModel, setSelectedModel] = useState('claude-haiku-4-5-20251001');
  const [modelStatus, setModelStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    if (isInitialized && !user) router.replace('/login');
  }, [isInitialized, user, router]);

  const fetchCredits = useCallback(async () => {
    try {
      const res = await apiClient.get<{ data: CreditSummary }>('/users/me/credits');
      setCredits(res.data);
      setSelectedModel(res.data.preferredModel);
    } catch {
      // ignore — user will see empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchCredits();
  }, [user, fetchCredits]);

  const handleSaveKey = async () => {
    if (!apiKey.trim()) return;
    setKeyStatus('saving');
    setKeyError('');
    try {
      await apiClient.put('/users/me/api-key', { apiKey: apiKey.trim() });
      setKeyStatus('saved');
      setApiKey('');
      fetchCredits();
      setTimeout(() => setKeyStatus('idle'), 2000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'API 키 저장에 실패했습니다.';
      setKeyError(msg);
      setKeyStatus('error');
    }
  };

  const handleRemoveKey = async () => {
    setKeyStatus('removing');
    try {
      await apiClient.delete('/users/me/api-key');
      fetchCredits();
      setKeyStatus('idle');
    } catch {
      setKeyStatus('idle');
    }
  };

  const handleSaveModel = async (modelId: string) => {
    setSelectedModel(modelId);
    setModelStatus('saving');
    try {
      await apiClient.put('/users/me/settings', { preferredModel: modelId });
      setModelStatus('saved');
      setTimeout(() => setModelStatus('idle'), 1500);
    } catch {
      setModelStatus('idle');
    }
  };

  if (!isInitialized || !user) return null;

  return (
    <div style={{ minHeight: '100vh', background: '#0d0d0f', color: '#e8e8ee', fontFamily: 'var(--font-sans, system-ui)' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', gap: 16 }}>
        <Link href="/editor" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.4)', textDecoration: 'none', fontSize: 13 }}>
          <ArrowLeft size={15} /> 에디터로 돌아가기
        </Link>
        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.08)' }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: '#e8e8ee' }}>설정</span>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px' }}>

        {/* ── Credit Balance ── */}
        <Section icon={<CreditCard size={16} />} title="크레딧 잔액">
          {loading ? (
            <div style={{ height: 80, display: 'flex', alignItems: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>불러오는 중...</div>
          ) : credits ? (
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <StatCard label="현재 잔액" value={`${credits.balance.toLocaleString()} cr`} highlight />
              <StatCard label="BYOK 상태" value={credits.hasByok ? '연결됨 (무제한)' : '미연결'} positive={credits.hasByok} />
              <StatCard label="현재 모델" value={MODELS.find(m => m.id === credits.preferredModel)?.label ?? credits.preferredModel} />
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>크레딧 정보를 불러올 수 없습니다.</div>
          )}
        </Section>

        {/* ── BYOK API Key ── */}
        <Section icon={<Key size={16} />} title="Anthropic API 키 (BYOK)">
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 20, lineHeight: 1.6 }}>
            자신의 Anthropic API 키를 등록하면 크레딧 소모 없이 무제한으로 분석할 수 있습니다.<br />
            키는 AES-256-GCM으로 암호화되어 저장됩니다.
          </p>

          {credits?.hasByok && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 8, background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)', marginBottom: 16 }}>
              <Check size={14} color="#22c55e" />
              <span style={{ fontSize: 13, color: '#22c55e' }}>API 키가 연결되어 있습니다.</span>
              <button
                onClick={handleRemoveKey}
                disabled={keyStatus === 'removing'}
                style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#e24b4b', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}
              >
                <Trash2 size={12} /> {keyStatus === 'removing' ? '제거 중...' : '제거'}
              </button>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-ant-api03-..."
                style={{
                  width: '100%', padding: '10px 40px 10px 14px',
                  borderRadius: 8, fontSize: 13, fontFamily: 'var(--font-mono)',
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${keyError ? '#e24b4b' : 'rgba(255,255,255,0.12)'}`,
                  color: '#e8e8ee', outline: 'none', boxSizing: 'border-box',
                }}
              />
              <button
                onClick={() => setShowKey(v => !v)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', display: 'flex' }}
              >
                {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <button
              onClick={handleSaveKey}
              disabled={!apiKey.trim() || keyStatus === 'saving'}
              style={{
                padding: '10px 20px', borderRadius: 8,
                background: keyStatus === 'saved' ? '#22c55e' : '#ea580c',
                color: '#fff', border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 700, flexShrink: 0,
                opacity: !apiKey.trim() || keyStatus === 'saving' ? 0.5 : 1,
              }}
            >
              {keyStatus === 'saving' ? '저장 중...' : keyStatus === 'saved' ? '저장됨' : '저장'}
            </button>
          </div>
          {keyError && <p style={{ fontSize: 12, color: '#e24b4b', marginTop: 8 }}>{keyError}</p>}
        </Section>

        {/* ── Model Preference ── */}
        <Section icon={<Cpu size={16} />} title="선호 AI 모델">
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 20, lineHeight: 1.6 }}>
            분석에 사용할 기본 모델을 선택하세요. BYOK 연결 시 크레딧 없이 모든 모델 사용이 가능합니다.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {MODELS.map((m) => {
              const active = selectedModel === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => handleSaveModel(m.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 16,
                    padding: '14px 18px', borderRadius: 10,
                    background: active ? `${m.color}10` : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${active ? m.color + '55' : 'rgba(255,255,255,0.08)'}`,
                    cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s',
                  }}
                >
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: m.color, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: active ? '#e8e8ee' : 'rgba(255,255,255,0.6)', marginBottom: 2 }}>{m.label}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>{m.desc}</div>
                  </div>
                  <div style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                    background: `${m.color}18`, color: m.color, fontFamily: 'var(--font-mono)', flexShrink: 0,
                  }}>
                    {m.creditCost} cr/파일
                  </div>
                  {active && <Check size={15} color={m.color} />}
                </button>
              );
            })}
          </div>
          {modelStatus === 'saving' && <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 10 }}>저장 중...</p>}
          {modelStatus === 'saved'  && <p style={{ fontSize: 12, color: '#22c55e', marginTop: 10 }}>모델 설정이 저장되었습니다.</p>}
        </Section>

      </div>
    </div>
  );
}

/* ── Shared sub-components ─────────────────────────────────────────────────── */

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <span style={{ color: '#ea580c' }}>{icon}</span>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#e8e8ee', margin: 0 }}>{title}</h2>
      </div>
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '24px 20px' }}>
        {children}
      </div>
    </div>
  );
}

function StatCard({ label, value, highlight, positive }: { label: string; value: string; highlight?: boolean; positive?: boolean }) {
  const color = positive === true ? '#22c55e' : positive === false ? 'rgba(255,255,255,0.35)' : highlight ? '#ea580c' : '#e8e8ee';
  return (
    <div style={{ minWidth: 140 }}>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color, fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em' }}>{value}</div>
    </div>
  );
}
