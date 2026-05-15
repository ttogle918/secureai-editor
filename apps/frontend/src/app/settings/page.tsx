'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Key, Cpu, CreditCard, Eye, EyeOff, Check, Trash2, Globe, Github, Copy, ToggleLeft, ToggleRight } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { apiClient, BASE_URL } from '@/lib/api/client';
import { useSecureStore, type DisplayLanguage } from '@/store/useSecureStore';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CreditSummary {
  balance: number;
  hasByok: boolean;
  preferredModel: string;
  modelCosts: Record<string, number>;
}

interface PrReviewHistoryItem {
  id: string;
  repoOwner: string;
  repoName: string;
  prNumber: number;
  headSha: string;
  status: 'pending' | 'completed' | 'error';
  vulnCount: number;
  checkRunId: number | null;
  createdAt: string;
  completedAt: string | null;
}

const MODELS = [
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku', tier: 'haiku', desc: '빠르고 저렴 — 대부분의 프로젝트에 추천', creditCost: 1, color: '#22c55e' },
  { id: 'claude-sonnet-4-6',          label: 'Claude Sonnet', tier: 'sonnet', desc: '균형 잡힌 성능 — 복잡한 코드베이스에 최적', creditCost: 5, color: '#f59e0b' },
  { id: 'claude-opus-4-7',            label: 'Claude Opus',   tier: 'opus',   desc: '최고 성능 — 대규모·고위험 분석', creditCost: 20, color: '#818cf8' },
] as const;

// ── Component ─────────────────────────────────────────────────────────────────

const LANGUAGES: Array<{ id: DisplayLanguage; label: string; desc: string }> = [
  { id: 'ko', label: '한국어', desc: '취약점 설명을 한국어로 번역해서 표시합니다.' },
  { id: 'en', label: 'English', desc: '원문 영어 그대로 표시합니다.' },
];

export default function SettingsPage() {
  const router = useRouter();
  const { user, isInitialized } = useAuthStore();
  const displayLanguage    = useSecureStore((s) => s.displayLanguage);
  const setDisplayLanguage = useSecureStore((s) => s.setDisplayLanguage);

  const [credits, setCredits] = useState<CreditSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState<'idle' | 'saving' | 'saved' | 'removing' | 'error'>('idle');
  const [keyError, setKeyError] = useState('');

  const [selectedModel, setSelectedModel] = useState('claude-haiku-4-5-20251001');
  const [modelStatus, setModelStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // GitHub 설정 상태
  const [blockMergeOnCritical, setBlockMergeOnCritical] = useState(false);
  const [githubSettingStatus, setGithubSettingStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [webhookCopied, setWebhookCopied] = useState(false);

  // PR 이력 조회 상태
  const [prHistoryRepoOwner, setPrHistoryRepoOwner] = useState('');
  const [prHistoryRepoName, setPrHistoryRepoName] = useState('');
  const [prHistoryList, setPrHistoryList] = useState<PrReviewHistoryItem[]>([]);
  const [prHistoryLoading, setPrHistoryLoading] = useState(false);
  const [prHistoryError, setPrHistoryError] = useState('');

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

  const handleToggleBlockMerge = async () => {
    const next = !blockMergeOnCritical;
    setBlockMergeOnCritical(next);
    setGithubSettingStatus('saving');
    try {
      await apiClient.put('/users/me/github-settings', { blockMergeOnCritical: next });
      setGithubSettingStatus('saved');
      setTimeout(() => setGithubSettingStatus('idle'), 2000);
    } catch {
      // 실패 시 이전 상태로 복원
      setBlockMergeOnCritical(!next);
      setGithubSettingStatus('idle');
    }
  };

  const handleCopyWebhookUrl = async () => {
    const webhookUrl = `${BASE_URL}/webhooks/github`;
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setWebhookCopied(true);
      setTimeout(() => setWebhookCopied(false), 2000);
    } catch {
      // clipboard API 미지원 환경 무시
    }
  };

  const handleFetchPrHistory = async () => {
    if (!prHistoryRepoOwner.trim() || !prHistoryRepoName.trim()) return;
    setPrHistoryLoading(true);
    setPrHistoryError('');
    setPrHistoryList([]);
    try {
      const params = new URLSearchParams({
        repoOwner: prHistoryRepoOwner.trim(),
        repoName: prHistoryRepoName.trim(),
      });
      const res = await apiClient.get<{ data: PrReviewHistoryItem[] }>(
        `/webhooks/github/history?${params.toString()}`
      );
      setPrHistoryList(res.data ?? []);
    } catch {
      setPrHistoryError('이력을 불러오지 못했습니다. 레포지토리 정보를 확인하세요.');
    } finally {
      setPrHistoryLoading(false);
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

        {/* ── Language ── */}
        <Section icon={<Globe size={16} />} title="표시 언어">
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 20, lineHeight: 1.6 }}>
            취약점 설명·분석 결과를 표시할 언어를 선택하세요.<br />
            DB에는 영어로 저장되며, 한국어 선택 시 AI가 실시간으로 번역합니다.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            {LANGUAGES.map((lang) => {
              const active = displayLanguage === lang.id;
              return (
                <button
                  key={lang.id}
                  onClick={() => setDisplayLanguage(lang.id)}
                  style={{
                    flex: 1, padding: '14px 18px', borderRadius: 10, textAlign: 'left',
                    background: active ? 'rgba(234,88,12,0.08)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${active ? 'rgba(234,88,12,0.4)' : 'rgba(255,255,255,0.08)'}`,
                    cursor: 'pointer', transition: 'border-color 0.15s',
                    display: 'flex', alignItems: 'center', gap: 14,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: active ? '#e8e8ee' : 'rgba(255,255,255,0.55)', marginBottom: 2 }}>
                      {lang.label}
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>{lang.desc}</div>
                  </div>
                  {active && <Check size={15} color="#ea580c" />}
                </button>
              );
            })}
          </div>
        </Section>

        {/* ── GitHub 연동 ── */}
        <Section icon={<Github size={16} />} title="GitHub 연동">
          {/* blockMergeOnCritical 토글 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#e8e8ee', marginBottom: 4 }}>
                Critical 취약점 발견 시 PR 머지 차단
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', lineHeight: 1.5 }}>
                활성화하면 Critical 수준 취약점이 발견된 PR의 머지가 차단됩니다.
              </div>
            </div>
            <button
              onClick={handleToggleBlockMerge}
              disabled={githubSettingStatus === 'saving'}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'none', border: 'none', cursor: 'pointer',
                color: blockMergeOnCritical ? '#22c55e' : 'rgba(255,255,255,0.25)',
                flexShrink: 0, padding: 4,
                opacity: githubSettingStatus === 'saving' ? 0.5 : 1,
              }}
              aria-label="blockMergeOnCritical 토글"
            >
              {blockMergeOnCritical
                ? <ToggleRight size={36} />
                : <ToggleLeft size={36} />}
            </button>
          </div>
          {githubSettingStatus === 'saved' && (
            <div style={{ fontSize: 12, color: '#22c55e', marginBottom: 16 }}>저장됨</div>
          )}

          {/* Webhook URL 표시 */}
          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.55)', marginBottom: 8 }}>
              Webhook URL
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                readOnly
                value={`${BASE_URL}/webhooks/github`}
                style={{
                  flex: 1, padding: '9px 14px', borderRadius: 8,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.09)',
                  color: 'rgba(255,255,255,0.5)',
                  fontSize: 12, fontFamily: 'var(--font-mono)',
                  outline: 'none', cursor: 'default',
                }}
              />
              <button
                onClick={handleCopyWebhookUrl}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '9px 16px', borderRadius: 8,
                  background: webhookCopied ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.06)',
                  border: `1px solid ${webhookCopied ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.1)'}`,
                  color: webhookCopied ? '#22c55e' : 'rgba(255,255,255,0.55)',
                  fontSize: 13, cursor: 'pointer', flexShrink: 0,
                }}
              >
                {webhookCopied ? <Check size={14} /> : <Copy size={14} />}
                {webhookCopied ? '복사됨' : '복사'}
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', marginTop: 6, lineHeight: 1.5 }}>
              GitHub 레포지토리 Settings → Webhooks에 위 URL을 등록하세요. Secret은 서버 환경변수로 관리됩니다.
            </div>
          </div>
        </Section>

        {/* ── PR 리뷰 이력 ── */}
        <Section icon={<Github size={16} />} title="PR 리뷰 이력">
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <input
              value={prHistoryRepoOwner}
              onChange={(e) => setPrHistoryRepoOwner(e.target.value)}
              placeholder="레포지토리 소유자 (e.g. octocat)"
              style={{
                flex: 1, minWidth: 160, padding: '9px 14px', borderRadius: 8,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#e8e8ee', fontSize: 13, outline: 'none',
              }}
            />
            <input
              value={prHistoryRepoName}
              onChange={(e) => setPrHistoryRepoName(e.target.value)}
              placeholder="레포지토리 이름 (e.g. my-repo)"
              style={{
                flex: 1, minWidth: 160, padding: '9px 14px', borderRadius: 8,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#e8e8ee', fontSize: 13, outline: 'none',
              }}
            />
            <button
              onClick={handleFetchPrHistory}
              disabled={prHistoryLoading || !prHistoryRepoOwner.trim() || !prHistoryRepoName.trim()}
              style={{
                padding: '9px 20px', borderRadius: 8,
                background: '#ea580c', color: '#fff', border: 'none',
                cursor: 'pointer', fontSize: 13, fontWeight: 700, flexShrink: 0,
                opacity: prHistoryLoading || !prHistoryRepoOwner.trim() || !prHistoryRepoName.trim() ? 0.5 : 1,
              }}
            >
              {prHistoryLoading ? '조회 중...' : '조회'}
            </button>
          </div>

          {prHistoryError && (
            <div style={{ fontSize: 13, color: '#e24b4b', marginBottom: 12 }}>{prHistoryError}</div>
          )}

          {prHistoryList.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    {['PR #', '브랜치 SHA', '상태', '취약점', '완료시각'].map((h) => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'rgba(255,255,255,0.3)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {prHistoryList.map((row) => (
                    <tr key={row.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '10px 12px', color: '#e8e8ee', fontFamily: 'var(--font-mono)' }}>
                        #{row.prNumber}
                      </td>
                      <td style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.45)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                        {row.headSha.slice(0, 7)}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <StatusBadge status={row.status} />
                      </td>
                      <td style={{ padding: '10px 12px', color: row.vulnCount > 0 ? '#f59e0b' : 'rgba(255,255,255,0.35)', fontFamily: 'var(--font-mono)' }}>
                        {row.vulnCount}
                      </td>
                      <td style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>
                        {row.completedAt ? new Date(row.completedAt).toLocaleString('ko-KR') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!prHistoryLoading && prHistoryList.length === 0 && !prHistoryError && (
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.2)', paddingTop: 4 }}>
              레포지토리 소유자와 이름을 입력 후 조회하세요.
            </div>
          )}
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

function StatusBadge({ status }: { status: 'pending' | 'completed' | 'error' }) {
  const map = {
    pending:   { label: '대기중',  bg: 'rgba(249,115,22,0.12)', color: '#f97316', border: 'rgba(249,115,22,0.3)' },
    completed: { label: '완료',    bg: 'rgba(34,197,94,0.10)',  color: '#22c55e', border: 'rgba(34,197,94,0.3)'  },
    error:     { label: '오류',    bg: 'rgba(226,75,75,0.10)',  color: '#e24b4b', border: 'rgba(226,75,75,0.3)'  },
  };
  const s = map[status] ?? map.error;
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
      background: s.bg, color: s.color, border: `0.5px solid ${s.border}`,
    }}>
      {s.label}
    </span>
  );
}
