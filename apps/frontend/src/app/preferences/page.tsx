'use client';
// app/preferences/page.tsx
// 초기 설정 페이지 — 언어, 테마, AI 말투, 음성 답변(Coming soon)
// 레퍼런스: frontend-refactoring/components/PreferencesSetup.jsx
import { useRouter } from 'next/navigation';
import { Globe, Layout, MessageSquare, Cpu, ArrowRight, Sparkles } from 'lucide-react';
import { useSecureStore } from '@/store/useSecureStore';
import type { PreferencesLanguage, PreferencesTheme, AiTone } from '@/store/useSecureStore';

// ── PrefShell — 전체 레이아웃 래퍼 ─────────────────────────
function PrefShell({ children, footer }: { children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-0)' }}>
      {/* 헤더 */}
      <div style={{
        height: 60,
        flexShrink: 0,
        borderBottom: '1px solid var(--hairline)',
        background: 'var(--bg-1)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
      }}>
        <div style={{
          fontSize: 18,
          fontWeight: 800,
          letterSpacing: '-0.03em',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span style={{ color: 'var(--orange)' }}>⬡</span>
          <span style={{ color: 'var(--text-active)' }}>Pagori</span>
        </div>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>언제든지 설정에서 변경 가능</span>
      </div>

      {/* 본문 */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ maxWidth: 820, margin: '0 auto', padding: '40px 32px' }}>
          <h1 style={{
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            marginBottom: 10,
            color: 'var(--text-active)',
          }}>
            Pagori 사용 환경을 설정해주세요
          </h1>
          <p style={{
            fontSize: 14,
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
            marginBottom: 32,
          }}>
            몇 가지 기본 설정을 해두면 더 편하게 쓸 수 있어요. 모두 선택사항이며, 언제든 설정에서 바꿀 수 있습니다.
          </p>
          {children}
        </div>
      </div>

      {footer}
    </div>
  );
}

// ── PrefSection — 섹션 카드 래퍼 ─────────────────────────────
function PrefSection({
  icon,
  title,
  hint,
  badge,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="card" style={{ padding: 22, marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{
          width: 30,
          height: 30,
          borderRadius: 7,
          background: 'var(--orange-dim)',
          color: 'var(--orange)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{title}</div>
          {hint && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{hint}</div>}
        </div>
        {badge}
      </div>
      {children}
    </section>
  );
}

// ── RadioDot — 라디오 버튼 시각화 ───────────────────────────
function RadioDot({ active }: { active: boolean }) {
  return (
    <span style={{
      width: 14,
      height: 14,
      borderRadius: 7,
      border: `1.5px solid ${active ? 'var(--orange-2)' : 'var(--border-3)'}`,
      background: active ? 'var(--orange-2)' : 'transparent',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}>
      {active && <span style={{ width: 6, height: 6, borderRadius: 3, background: '#fff' }} />}
    </span>
  );
}

// ── 섹션 1: 인터페이스 언어 ──────────────────────────────────
const LANGUAGES: Array<{ id: PreferencesLanguage; flag: string; name: string; sub: string }> = [
  { id: 'ko', flag: '🇰🇷', name: '한국어',  sub: 'Korean' },
  { id: 'en', flag: '🇺🇸', name: 'English', sub: '영어' },
  { id: 'ja', flag: '🇯🇵', name: '日本語',  sub: '일본어' },
  { id: 'zh', flag: '🇨🇳', name: '中文',    sub: '중국어 간체' },
  { id: 'es', flag: '🇪🇸', name: 'Español', sub: '스페인어' },
  { id: 'de', flag: '🇩🇪', name: 'Deutsch', sub: '독일어' },
];

function LanguageSection({ selected, onSelect }: {
  selected: PreferencesLanguage;
  onSelect: (lang: PreferencesLanguage) => void;
}) {
  return (
    <PrefSection
      icon={<Globe size={14} />}
      title="인터페이스 언어"
      hint="대시보드, 알림, 리포트의 표시 언어"
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {LANGUAGES.map((lang) => {
          const active = selected === lang.id;
          return (
            <label
              key={lang.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 8,
                background: active ? 'var(--orange-dim)' : 'var(--bg-3)',
                border: `1px solid ${active ? 'rgba(249,115,22,0.45)' : 'var(--border)'}`,
                cursor: 'pointer',
                outline: active ? '1.5px solid var(--orange-2)' : 'none',
                outlineOffset: -1,
              }}
            >
              <input
                type="radio"
                name="language"
                value={lang.id}
                checked={active}
                onChange={() => onSelect(lang.id)}
                style={{ display: 'none' }}
              />
              <span style={{ fontSize: 20 }}>{lang.flag}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: active ? 'var(--text-active)' : 'var(--text-primary)',
                }}>
                  {lang.name}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
                  {lang.sub}
                </div>
              </div>
              <RadioDot active={active} />
            </label>
          );
        })}
      </div>
    </PrefSection>
  );
}

// ── 섹션 2: 테마 ─────────────────────────────────────────────
const THEMES: Array<{ id: PreferencesTheme; label: string; preview: string }> = [
  { id: 'dark',  label: '다크 (OLED)', preview: '#080809' },
  { id: 'dim',   label: '딤',          preview: '#25252d' },
  { id: 'light', label: '라이트',      preview: '#f7f5f0' },
];

function ThemeSection({ selected, onSelect }: {
  selected: PreferencesTheme;
  onSelect: (theme: PreferencesTheme) => void;
}) {
  return (
    <PrefSection
      icon={<Layout size={14} />}
      title="모양"
      hint="테마와 정보 밀도"
    >
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>테마</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {THEMES.map((th) => {
            const active = selected === th.id;
            const isLight = th.id === 'light';
            return (
              <label
                key={th.id}
                style={{
                  padding: 12,
                  borderRadius: 8,
                  background: active ? 'var(--orange-dim)' : 'var(--bg-3)',
                  border: `1px solid ${active ? 'rgba(249,115,22,0.40)' : 'var(--border)'}`,
                  cursor: 'pointer',
                  outline: active ? '1.5px solid var(--orange-2)' : 'none',
                  outlineOffset: -1,
                }}
              >
                <input
                  type="radio"
                  name="theme"
                  value={th.id}
                  checked={active}
                  onChange={() => onSelect(th.id)}
                  style={{ display: 'none' }}
                />
                {/* 테마 미리보기 박스 */}
                <div style={{
                  width: '100%',
                  height: 48,
                  borderRadius: 6,
                  marginBottom: 8,
                  background: th.preview,
                  border: '1px solid var(--border)',
                  position: 'relative',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    position: 'absolute', top: 6, left: 6, right: 6, height: 4,
                    background: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)',
                    borderRadius: 2,
                  }} />
                  <div style={{
                    position: 'absolute', top: 14, left: 6, width: '60%', height: 3,
                    background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)',
                    borderRadius: 2,
                  }} />
                  <div style={{
                    position: 'absolute', bottom: 6, left: 6, width: 12, height: 4,
                    background: 'var(--orange-2)', borderRadius: 2,
                  }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>{th.label}</span>
                  <RadioDot active={active} />
                </div>
              </label>
            );
          })}
        </div>
      </div>
    </PrefSection>
  );
}

// ── 섹션 3: AI 챗봇 말투 ──────────────────────────────────────
const TONES: Array<{ id: AiTone; name: string; sub: string; sample: string }> = [
  {
    id: 'direct',
    name: '간결',
    sub: '핵심만 짧고 정확하게',
    sample: 'SQL Injection 발견. parameterized query 사용 권장.',
  },
  {
    id: 'friendly',
    name: '친근',
    sub: '편하게 말 거는 느낌',
    sample: '어머, 여기 SQL Injection 있네요! parameterized query로 바꿔주시면 안전해요 :)',
  },
  {
    id: 'expert',
    name: '전문가',
    sub: '기술 깊이 있는 설명',
    sample: 'CWE-89 (SQL Injection). prepared statement 또는 parameterized query 패턴을 적용하여 입력값을 데이터로 분리하세요.',
  },
  {
    id: 'teaching',
    name: '멘토',
    sub: '배우기 좋게 설명',
    sample: '이 코드의 위험은 사용자 입력이 그대로 쿼리에 들어가는 점이에요. parameterized query를 쓰면 입력이 "데이터"로 다뤄져서 안전해집니다.',
  },
];

function ToneSection({ selected, onSelect }: {
  selected: AiTone;
  onSelect: (tone: AiTone) => void;
}) {
  return (
    <PrefSection
      icon={<MessageSquare size={14} />}
      title="AI 챗봇 말투"
      hint="예시 문장을 보고 가장 마음에 드는 톤을 고르세요"
      badge={
        <span className="chip chip-orange" style={{ height: 20, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Sparkles size={9} />
          실시간 미리보기
        </span>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {TONES.map((tone) => {
          const active = selected === tone.id;
          return (
            <label
              key={tone.id}
              style={{
                display: 'flex',
                gap: 12,
                padding: '12px 14px',
                borderRadius: 8,
                background: active ? 'var(--orange-dim)' : 'var(--bg-3)',
                border: `1px solid ${active ? 'rgba(249,115,22,0.40)' : 'var(--border)'}`,
                cursor: 'pointer',
                outline: active ? '1.5px solid var(--orange-2)' : 'none',
                outlineOffset: -1,
              }}
            >
              <input
                type="radio"
                name="aiTone"
                value={tone.id}
                checked={active}
                onChange={() => onSelect(tone.id)}
                style={{ display: 'none' }}
              />
              <RadioDot active={active} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                  <span style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: active ? 'var(--text-active)' : 'var(--text-primary)',
                  }}>
                    {tone.name}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>· {tone.sub}</span>
                </div>
                <div style={{
                  padding: '8px 10px',
                  borderRadius: 6,
                  background: 'var(--bg-2)',
                  border: '1px solid var(--border)',
                  fontSize: 11,
                  color: 'var(--text-on-bg)',
                  lineHeight: 1.55,
                  fontStyle: 'italic',
                }}>
                  <Sparkles size={9} color="var(--orange)" style={{ verticalAlign: '-1px', marginRight: 5 }} />
                  {tone.sample}
                </div>
              </div>
            </label>
          );
        })}
      </div>
    </PrefSection>
  );
}

// ── 섹션 4: 음성 답변 (Coming soon / 비활성화) ───────────────
function VoiceSection() {
  return (
    <PrefSection
      icon={<Cpu size={14} />}
      title="음성 답변 (Coming soon)"
      hint="목소리 톤과 성별을 미리 선택해두세요"
      badge={
        <span className="chip" style={{
          height: 20,
          color: 'var(--tag-1)',
          borderColor: 'rgba(129,140,248,0.4)',
        }}>
          Sprint 8
        </span>
      }
    >
      <div style={{
        padding: 12,
        borderRadius: 8,
        background: 'var(--bg-3)',
        border: '1px dashed var(--border-2)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 14,
        opacity: 0.6,
        pointerEvents: 'none',
      }}>
        <div style={{
          width: 32,
          height: 32,
          borderRadius: 6,
          background: 'var(--bg-2)',
          color: 'var(--text-secondary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
        }}>
          🔊
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700 }}>음성 답변 활성화</div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
            AI 답변을 음성으로도 들을 수 있어요 (출시 후 자동 적용)
          </div>
        </div>
        <span style={{
          width: 32,
          height: 18,
          borderRadius: 9,
          background: 'var(--border-3)',
          position: 'relative',
          flexShrink: 0,
        }}>
          <span style={{
            position: 'absolute',
            top: 2,
            left: 2,
            width: 14,
            height: 14,
            borderRadius: 7,
            background: '#fff',
          }} />
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, opacity: 0.5, pointerEvents: 'none' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>성별</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { id: 'female', label: '여성', emoji: '👩' },
              { id: 'male',   label: '남성', emoji: '👨' },
              { id: 'neutral',label: '중성', emoji: '🧑' },
            ].map((g) => (
              <div key={g.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 12px',
                borderRadius: 6,
                background: 'var(--bg-3)',
                border: '1px solid var(--border)',
              }}>
                <span style={{ fontSize: 18 }}>{g.emoji}</span>
                <span style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>{g.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>목소리 톤</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { id: 'warm',     label: '따뜻한', sub: '편안한 저음' },
              { id: 'crisp',    label: '또렷한', sub: '명료한 중음' },
              { id: 'energetic',label: '활기찬', sub: '밝은 고음' },
            ].map((v) => (
              <div key={v.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 12px',
                borderRadius: 6,
                background: 'var(--bg-3)',
                border: '1px solid var(--border)',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{v.label}</div>
                  <div style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{v.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PrefSection>
  );
}

// ── 메인 페이지 컴포넌트 ─────────────────────────────────────
export default function PreferencesPage() {
  const router = useRouter();

  const language    = useSecureStore((s) => s.language);
  const setLanguage = useSecureStore((s) => s.setLanguage);
  const theme       = useSecureStore((s) => s.theme);
  const setTheme    = useSecureStore((s) => s.setTheme);
  const aiTone      = useSecureStore((s) => s.aiTone);
  const setAiTone   = useSecureStore((s) => s.setAiTone);

  const handleSave = () => {
    router.push('/editor');
  };

  const handleSkip = () => {
    router.push('/editor');
  };

  return (
    <PrefShell
      footer={
        <div style={{
          padding: '14px 32px',
          borderTop: '1px solid var(--hairline)',
          background: 'var(--bg-1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}>
          <button
            className="btn btn-ghost"
            onClick={handleSkip}
            style={{ color: 'var(--text-tertiary)' }}
          >
            나중에 (기본값 사용)
          </button>
          <button
            className="btn btn-primary btn-lg"
            onClick={handleSave}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            저장하고 시작
            <ArrowRight size={11} />
          </button>
        </div>
      }
    >
      <LanguageSection selected={language} onSelect={setLanguage} />
      <ThemeSection    selected={theme}    onSelect={setTheme} />
      <ToneSection     selected={aiTone}   onSelect={setAiTone} />
      <VoiceSection />
    </PrefShell>
  );
}
