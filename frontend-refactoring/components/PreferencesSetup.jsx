/* global React, Icon, Chip, WindowChrome, PagoriLockup, PagoriMark */
// PreferencesSetup.jsx — Initial setup / preferences:
//   • Language (interface)
//   • AI chat tone
//   • Future: AI voice (tone + gender) for spoken responses
//
// Shown as a dedicated step at first login OR accessible from settings.

const { useState: useStatePref } = React;

function PrefShell({ title, subtitle, children, footer }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-0)' }}>
      <div style={{
        height: 60, flexShrink: 0,
        borderBottom: '1px solid var(--hairline)',
        background: 'var(--bg-1)',
        display: 'flex', alignItems: 'center', padding: '0 24px',
      }}>
        <PagoriLockup size={24} subtitle="security audit agent" />
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>언제든지 설정에서 변경 가능</span>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ maxWidth: 820, margin: '0 auto', padding: '40px 32px' }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 10 }}>{title}</h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 32 }}>{subtitle}</p>
          {children}
        </div>
      </div>

      {footer}
    </div>
  );
}

// Section card
function PrefSection({ icon, title, hint, badge, children }) {
  return (
    <section className="card" style={{ padding: 22, marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 7,
          background: 'var(--orange-dim)', color: 'var(--orange)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><Icon name={icon} size={14} /></div>
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

// ─── Language picker ─────────────────────────────────────
function LanguageSection() {
  const langs = [
    { id:'ko', flag:'🇰🇷', name:'한국어',   sub:'Korean',     active: true },
    { id:'en', flag:'🇺🇸', name:'English',  sub:'영어' },
    { id:'ja', flag:'🇯🇵', name:'日本語',   sub:'일본어' },
    { id:'zh', flag:'🇨🇳', name:'中文',     sub:'중국어 간체' },
    { id:'es', flag:'🇪🇸', name:'Español',  sub:'스페인어' },
    { id:'de', flag:'🇩🇪', name:'Deutsch',  sub:'독일어' },
  ];

  return (
    <PrefSection
      icon="globe"
      title="인터페이스 언어"
      hint="대시보드, 알림, 리포트의 표시 언어"
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {langs.map(l => (
          <label key={l.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', borderRadius: 8,
            background: l.active ? 'var(--orange-dim)' : 'var(--bg-3)',
            border: `1px solid ${l.active ? 'rgba(249,115,22,0.45)' : 'var(--border)'}`,
            cursor: 'pointer',
            outline: l.active ? '1.5px solid var(--orange-2)' : 'none', outlineOffset: -1,
          }}>
            <span style={{ fontSize: 20 }}>{l.flag}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: l.active ? 'var(--text-active)' : 'var(--text-primary)' }}>{l.name}</div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{l.sub}</div>
            </div>
            <span style={{
              width: 14, height: 14, borderRadius: 7,
              border: `1.5px solid ${l.active ? 'var(--orange-2)' : 'var(--border-3)'}`,
              background: l.active ? 'var(--orange-2)' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              {l.active && <span style={{ width: 6, height: 6, borderRadius: 3, background: '#fff' }} />}
            </span>
          </label>
        ))}
      </div>
    </PrefSection>
  );
}

// ─── AI tone picker — affects chat responses ────────────
function TonePicker() {
  const tones = [
    { id:'concise', name:'간결',       sub:'핵심만 짧고 정확하게', sample:'SQL Injection 발견. parameterized query 사용 권장.', active: true },
    { id:'friendly', name:'친근',      sub:'편하게 말 거는 느낌',    sample:'어머, 여기 SQL Injection 있네요! parameterized query로 바꿔주시면 안전해요 :)' },
    { id:'formal', name:'정중',        sub:'존댓말 · 비즈니스 톤',  sample:'SQL Injection 취약점이 발견되었습니다. parameterized query 사용을 권장드립니다.' },
    { id:'expert', name:'전문가',      sub:'기술 깊이 있는 설명',   sample:'CWE-89 (SQL Injection). prepared statement 또는 parameterized query 패턴을 적용하여 입력값을 데이터로 분리하세요.' },
    { id:'mentor', name:'멘토',        sub:'배우기 좋게 설명',     sample:'이 코드의 위험은 사용자 입력이 그대로 쿼리에 들어가는 점이에요. parameterized query를 쓰면 입력이 "데이터"로 다뤄져서 안전해집니다.' },
  ];

  return (
    <PrefSection
      icon="message"
      title="AI 챗봇 말투"
      hint="예시 문장을 보고 가장 마음에 드는 톤을 고르세요"
      badge={<span className="chip chip-orange" style={{ height: 20 }}><Icon name="sparkle" size={9} />실시간 미리보기</span>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tones.map(t => (
          <label key={t.id} style={{
            display: 'flex', gap: 12,
            padding: '12px 14px', borderRadius: 8,
            background: t.active ? 'var(--orange-dim)' : 'var(--bg-3)',
            border: `1px solid ${t.active ? 'rgba(249,115,22,0.40)' : 'var(--border)'}`,
            cursor: 'pointer',
            outline: t.active ? '1.5px solid var(--orange-2)' : 'none', outlineOffset: -1,
          }}>
            <span style={{
              width: 14, height: 14, borderRadius: 7, marginTop: 2,
              border: `1.5px solid ${t.active ? 'var(--orange-2)' : 'var(--border-3)'}`,
              background: t.active ? 'var(--orange-2)' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              {t.active && <span style={{ width: 6, height: 6, borderRadius: 3, background: '#fff' }} />}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: t.active ? 'var(--text-active)' : 'var(--text-primary)' }}>{t.name}</span>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>· {t.sub}</span>
              </div>
              <div style={{
                padding: '8px 10px', borderRadius: 6,
                background: 'var(--bg-2)', border: '1px solid var(--border)',
                fontSize: 11, color: 'var(--text-on-bg)', lineHeight: 1.55,
                fontStyle: 'italic',
              }}>
                <Icon name="sparkle" size={9} color="var(--orange)" style={{ verticalAlign: '-1px', marginRight: 5 }} />
                {t.sample}
              </div>
            </div>
          </label>
        ))}
      </div>
    </PrefSection>
  );
}

// ─── Voice section — preview future feature ─────────────
function VoiceSection() {
  return (
    <PrefSection
      icon="cpu"
      title="음성 답변 (Coming soon)"
      hint="목소리 톤과 성별을 미리 선택해두세요"
      badge={<span className="chip" style={{ height: 20, color: 'var(--tag-1)', borderColor: 'rgba(129,140,248,0.4)' }}>Sprint 8</span>}
    >
      {/* Voice toggle */}
      <div style={{
        padding: 12, borderRadius: 8,
        background: 'var(--bg-3)', border: '1px dashed var(--border-2)',
        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 6,
          background: 'var(--bg-2)', color: 'var(--text-secondary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>🔊</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700 }}>음성 답변 활성화</div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>AI 답변을 음성으로도 들을 수 있어요 (출시 후 자동 적용)</div>
        </div>
        <span style={{
          width: 32, height: 18, borderRadius: 9,
          background: 'var(--orange-2)', position: 'relative', flexShrink: 0,
        }}>
          <span style={{ position: 'absolute', top: 2, left: 16, width: 14, height: 14, borderRadius: 7, background: '#fff' }} />
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {/* Gender */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>성별</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { id:'female', label:'여성', emoji:'👩', active: true },
              { id:'male', label:'남성', emoji:'👨' },
              { id:'neutral', label:'중성', emoji:'🧑' },
            ].map(g => (
              <label key={g.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', borderRadius: 6,
                background: g.active ? 'var(--orange-dim)' : 'var(--bg-3)',
                border: `1px solid ${g.active ? 'rgba(249,115,22,0.40)' : 'var(--border)'}`,
                cursor: 'pointer',
              }}>
                <span style={{ fontSize: 18 }}>{g.emoji}</span>
                <span style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>{g.label}</span>
                <span style={{
                  width: 12, height: 12, borderRadius: 6,
                  border: `1.5px solid ${g.active ? 'var(--orange-2)' : 'var(--border-3)'}`,
                  background: g.active ? 'var(--orange-2)' : 'transparent',
                }} />
              </label>
            ))}
          </div>
        </div>

        {/* Tone */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>목소리 톤</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { id:'warm', label:'따뜻한', sub:'편안한 저음', active: true },
              { id:'crisp', label:'또렷한', sub:'명료한 중음' },
              { id:'energetic', label:'활기찬', sub:'밝은 고음' },
            ].map(v => (
              <label key={v.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', borderRadius: 6,
                background: v.active ? 'var(--orange-dim)' : 'var(--bg-3)',
                border: `1px solid ${v.active ? 'rgba(249,115,22,0.40)' : 'var(--border)'}`,
                cursor: 'pointer',
              }}>
                <button title="미리듣기" style={{
                  width: 24, height: 24, borderRadius: 12,
                  background: v.active ? 'var(--orange-2)' : 'var(--bg-2)',
                  color: v.active ? '#fff' : 'var(--text-secondary)',
                  border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', flexShrink: 0,
                }}>
                  <Icon name="play" size={9} fill="currentColor" />
                </button>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{v.label}</div>
                  <div style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{v.sub}</div>
                </div>
                <span style={{
                  width: 12, height: 12, borderRadius: 6,
                  border: `1.5px solid ${v.active ? 'var(--orange-2)' : 'var(--border-3)'}`,
                  background: v.active ? 'var(--orange-2)' : 'transparent', flexShrink: 0,
                }} />
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Speed slider */}
      <div style={{ marginTop: 14, padding: 12, background: 'var(--bg-3)', borderRadius: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>읽기 속도</span>
          <div style={{ flex: 1 }} />
          <span className="mono" style={{ fontSize: 11, color: 'var(--text-active)', fontWeight: 700 }}>1.0×</span>
        </div>
        <div style={{ position: 'relative', height: 4, background: 'var(--bg-1)', borderRadius: 2 }}>
          <div style={{ position: 'absolute', left: 0, top: 0, height: 4, width: '40%', background: 'var(--orange-2)', borderRadius: 2 }} />
          <div style={{ position: 'absolute', left: '38%', top: -5, width: 14, height: 14, borderRadius: 7, background: '#fff', border: '2px solid var(--orange-2)' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 9, color: 'var(--text-tertiary)' }}>
          <span>0.5×</span>
          <span>1.0×</span>
          <span>2.0×</span>
        </div>
      </div>
    </PrefSection>
  );
}

// ─── Theme + Density (here too — initial setup) ─────────
function ThemeSection() {
  return (
    <PrefSection
      icon="layout"
      title="모양"
      hint="테마와 정보 밀도"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>테마</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {[
              { id:'dark', label:'다크 (OLED)', preview: '#080809', active: true },
              { id:'dim', label:'딤', preview: '#25252d' },
              { id:'light', label:'라이트', preview: '#f7f5f0' },
            ].map(th => (
              <label key={th.id} style={{
                padding: 12, borderRadius: 8,
                background: th.active ? 'var(--orange-dim)' : 'var(--bg-3)',
                border: `1px solid ${th.active ? 'rgba(249,115,22,0.40)' : 'var(--border)'}`,
                cursor: 'pointer',
                outline: th.active ? '1.5px solid var(--orange-2)' : 'none', outlineOffset: -1,
              }}>
                <div style={{
                  width: '100%', height: 48, borderRadius: 6, marginBottom: 8,
                  background: th.preview, border: '1px solid var(--border)',
                  position: 'relative', overflow: 'hidden',
                }}>
                  <div style={{ position: 'absolute', top: 6, left: 6, right: 6, height: 4, background: th.id === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)', borderRadius: 2 }} />
                  <div style={{ position: 'absolute', top: 14, left: 6, width: '60%', height: 3, background: th.id === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)', borderRadius: 2 }} />
                  <div style={{ position: 'absolute', bottom: 6, left: 6, width: 12, height: 4, background: 'var(--orange-2)', borderRadius: 2 }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>{th.label}</span>
                  <span style={{
                    width: 14, height: 14, borderRadius: 7,
                    border: `1.5px solid ${th.active ? 'var(--orange-2)' : 'var(--border-3)'}`,
                    background: th.active ? 'var(--orange-2)' : 'transparent',
                  }} />
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>
    </PrefSection>
  );
}

// ─── Combined screen ─────────────────────────────────────
function PreferencesSetup({ width = 1100, height = 820 }) {
  return (
    <WindowChrome width={width} height={height} title="Pagori · 초기 설정">
      <PrefShell
        title="Pagori 사용 환경을 설정해주세요"
        subtitle={"몇 가지 기본 설정을 해두면 더 편하게 쓸 수 있어요. 모두 선택사항이며, 언제든 설정에서 바꿀 수 있습니다."}
        footer={
          <div style={{
            padding: '14px 32px', borderTop: '1px solid var(--hairline)',
            background: 'var(--bg-1)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          }}>
            <button className="btn btn-ghost" style={{ color: 'var(--text-tertiary)' }}>나중에 (기본값 사용)</button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn">이전</button>
              <button className="btn btn-primary btn-lg">저장하고 시작 <Icon name="arrowRight" size={11} stroke={2.2} /></button>
            </div>
          </div>
        }
      >
        <LanguageSection />
        <ThemeSection />
        <TonePicker />
        <VoiceSection />
      </PrefShell>
    </WindowChrome>
  );
}

Object.assign(window, { PreferencesSetup });
