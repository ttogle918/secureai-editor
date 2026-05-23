/* global React, Icon, Chip, WindowChrome, PagoriLockup, PagoriMark */
// Onboarding.jsx — Step 1/2/3 onboarding flow.
//
// Updates per feedback (round 3):
//   • Step 1: "주요 언어" → "프로젝트 유형" (서버/웹/모바일/데스크탑/임베디드/기타)
//   • Step 1: "팀" 선택 시 이메일 / @handle 초대 UI 노출
//   • Step 2: AI 추천 필터 자동 적용 + 제거 가능 + "+ 필터 추가"
//   • Step 3: "스킵 — 에디터로 바로 가기" 옵션 (분석 안 하고 진입)
//   • Header에 Pagori 브랜드 lockup 사용

// ─── Step indicator ────────────────────────────────────────
function StepIndicator({ current = 1, steps = ['프로젝트 생성', '분석 소스', '첫 분석 시작'] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 40 }}>
      {steps.map((s, i) => {
        const n = i + 1;
        const isCurrent = n === current;
        const isDone = n < current;
        const color = isDone ? 'var(--low)' : isCurrent ? 'var(--orange)' : 'var(--text-tertiary)';
        return (
          <React.Fragment key={i}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 26, height: 26, borderRadius: 13,
                background: isCurrent ? 'var(--orange-2)' : isDone ? 'var(--low)' : 'var(--bg-3)',
                color: isCurrent || isDone ? '#fff' : 'var(--text-tertiary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)',
                border: isCurrent ? 'none' : `1px solid ${isDone ? 'var(--low)' : 'var(--border)'}`,
                boxShadow: isCurrent ? '0 0 0 4px var(--orange-dim)' : 'none',
              }}>
                {isDone ? <Icon name="check" size={11} stroke={2.6} /> : n}
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' }}>STEP {n}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: isCurrent ? 'var(--text-primary)' : color }}>{s}</div>
              </div>
            </div>
            {i < steps.length - 1 && (
              <div style={{
                flex: 1, height: 1,
                background: isDone || (isCurrent && i + 1 < current) ? 'var(--low)' : 'var(--border)',
              }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Onboarding shell ──────────────────────────────────────
function OnboardingShell({ children, step }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-0)' }}>
      <div style={{
        height: 60, flexShrink: 0,
        borderBottom: '1px solid var(--hairline)',
        background: 'var(--bg-1)',
        display: 'flex', alignItems: 'center', padding: '0 24px',
      }}>
        <PagoriLockup size={26} subtitle="security audit agent" />
        <div style={{ flex: 1 }} />
        <button className="btn btn-sm btn-ghost" style={{ color: 'var(--text-tertiary)' }}>나중에 설정</button>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ maxWidth: 920, margin: '0 auto', padding: '48px 32px' }}>
          <StepIndicator current={step} />
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── Step 1: Create project ────────────────────────────────
function OnboardStep1() {
  // Project types — server/web/mobile/desktop/embedded/etc.
  const projectTypes = [
    { id:'server',    icon:'cpu',    label:'서버 / API',    sub:'Spring · Node · FastAPI', active: true },
    { id:'web',       icon:'globe',  label:'웹 프론트',     sub:'React · Vue · Svelte' },
    { id:'mobile',    icon:'panel',  label:'모바일 앱',     sub:'Android · iOS · Flutter' },
    { id:'desktop',   icon:'layout', label:'데스크탑 SW',   sub:'Tauri · Electron · WinForms' },
    { id:'embedded',  icon:'layers', label:'임베디드 / IoT', sub:'C · C++ · Rust · MCU' },
    { id:'etc',       icon:'package', label:'기타',          sub:'CLI · 라이브러리 등' },
  ];

  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 10 }}>
        새 프로젝트를 만들어보세요
      </h1>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 32 }}>
        분석 결과와 채팅 이력이 프로젝트 단위로 저장됩니다.<br />
        팀이 있다면 멤버를 초대할 수도 있습니다.
      </p>

      <div className="card" style={{ padding: 28 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

          {/* Name + Description */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 14 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>프로젝트 이름</label>
              <input className="field" defaultValue="shop-api" style={{ fontFamily: 'var(--font-mono)' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>설명 (선택)</label>
              <input className="field" placeholder="이 프로젝트가 무엇인지 한 줄로…" />
            </div>
          </div>

          {/* Project type — 6 cards */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>프로젝트 유형</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {projectTypes.map(pt => (
                <button key={pt.id} style={{
                  textAlign: 'left', padding: '10px 12px', borderRadius: 8,
                  background: pt.active ? 'var(--orange-dim)' : 'var(--bg-3)',
                  border: `1px solid ${pt.active ? 'rgba(249,115,22,0.45)' : 'var(--border)'}`,
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                    background: pt.active ? 'var(--orange-2)' : 'var(--bg-2)',
                    color: pt.active ? '#fff' : 'var(--text-secondary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon name={pt.icon} size={13} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{pt.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{pt.sub}</div>
                  </div>
                </button>
              ))}
            </div>
            <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-tertiary)' }}>
              유형은 AI 분석 시 사용되는 룰셋과 스캔 방식에 영향을 줍니다 — 나중에 변경 가능
            </div>
          </div>

          {/* Visibility + Team invite */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>가시성</label>
            <div style={{ display: 'flex', height: 32, padding: 2, background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 6, maxWidth: 280 }}>
              {[
                { id:'private', icon:'lock', label:'비공개 (나만)' },
                { id:'team', icon:'users', label:'팀과 공유', active: true },
              ].map(o => (
                <button key={o.id} style={{
                  flex: 1, border: 'none', borderRadius: 4,
                  background: o.active ? 'var(--bg-1)' : 'transparent',
                  color: o.active ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}><Icon name={o.icon} size={11} />{o.label}</button>
              ))}
            </div>

            {/* Team invite UI — visible when "팀과 공유" selected */}
            <div style={{
              marginTop: 12, padding: 14,
              background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Icon name="users" size={13} color="var(--orange)" />
                <span style={{ fontSize: 12, fontWeight: 700 }}>팀원 초대</span>
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>이메일 또는 @닉네임 — Enter로 추가</span>
              </div>

              {/* Input + add button */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 10px',
                background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6,
                marginBottom: 10,
              }}>
                {/* Existing invites as chips */}
                <span className="chip" style={{ height: 22, padding: '0 4px 0 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 14, height: 14, borderRadius: 7, background: 'linear-gradient(135deg, var(--tag-3), var(--tag-1))', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, fontWeight: 700, color: '#fff' }}>SH</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>@seohyun</span>
                  <Icon name="x" size={10} color="var(--text-tertiary)" />
                </span>
                <span className="chip" style={{ height: 22, padding: '0 4px 0 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Icon name="mail" size={10} color="var(--text-tertiary)" />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>kim@example.com</span>
                  <span className="chip chip-orange" style={{ height: 14, fontSize: 8, padding: '0 4px', marginLeft: 2 }}>초대 발송</span>
                  <Icon name="x" size={10} color="var(--text-tertiary)" />
                </span>
                <input
                  placeholder="이메일 또는 @닉네임…"
                  style={{
                    flex: 1, background: 'transparent', border: 'none', outline: 'none',
                    fontSize: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)',
                    minWidth: 140,
                  }}
                />
              </div>

              {/* Role + invite explanation */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: 'var(--text-tertiary)' }}>
                <span>역할:</span>
                <span className="chip chip-orange" style={{ height: 18 }}>member</span>
                <Icon name="chevronDown" size={9} />
                <span style={{ marginLeft: 'auto' }}>
                  <Icon name="alert" size={10} style={{ verticalAlign: '-1px', marginRight: 4 }} />
                  미가입 사용자는 이메일로 초대 링크가 발송됩니다
                </span>
              </div>
            </div>
          </div>

          {/* AI model */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>AI 모델</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {[
                { id:'haiku', label:'Haiku 4.5', sub:'빠름 · 5크레딧/파일', recommended: true },
                { id:'sonnet', label:'Sonnet 4.5', sub:'균형 · 15크레딧/파일' },
                { id:'opus', label:'Opus 4', sub:'정확 · 75크레딧/파일' },
              ].map((m) => (
                <button key={m.id} style={{
                  textAlign: 'left', padding: 12, borderRadius: 8,
                  background: m.recommended ? 'var(--orange-dim)' : 'var(--bg-3)',
                  border: `1px solid ${m.recommended ? 'rgba(249,115,22,0.40)' : 'var(--border)'}`,
                  cursor: 'pointer', position: 'relative',
                }}>
                  {m.recommended && (
                    <span style={{ position: 'absolute', top: 8, right: 8, fontSize: 8, fontWeight: 700, color: 'var(--orange)', letterSpacing: '0.05em', fontFamily: 'var(--font-mono)' }}>추천</span>
                  )}
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 3 }}>{m.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{m.sub}</div>
                </button>
              ))}
            </div>
          </div>

        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--hairline)' }}>
          <button className="btn">취소</button>
          <button className="btn btn-primary">다음 — 분석 소스 선택 <Icon name="arrowRight" size={11} stroke={2.2} /></button>
        </div>
      </div>
    </div>
  );
}

// ─── Step 2: Choose source + auto-recommended file filters ────
function OnboardStep2() {
  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 10 }}>
        무엇을 분석할까요?
      </h1>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 32 }}>
        세 가지 소스 중 하나를 고르세요. 분석 후에도 언제든 추가할 수 있습니다.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { id:'github', icon:'github', title:'GitHub 레포', desc:'OAuth로 연동된 레포에서 브랜치 선택', recommended: true },
          { id:'local', icon:'folderOpen', title:'로컬 폴더', desc:'showDirectoryPicker로 폴더 열기 또는 드래그' },
          { id:'upload', icon:'upload', title:'ZIP 업로드', desc:'프로젝트 zip 파일 업로드 (최대 100MB)' },
        ].map((o) => (
          <button key={o.id} style={{
            textAlign: 'left', padding: 20, borderRadius: 10,
            background: o.recommended ? 'var(--orange-dim)' : 'var(--bg-2)',
            border: `1px solid ${o.recommended ? 'rgba(249,115,22,0.40)' : 'var(--border)'}`,
            cursor: 'pointer', position: 'relative',
            display: 'flex', flexDirection: 'column', gap: 10,
            outline: o.recommended ? '2px solid var(--orange-2)' : 'none',
            outlineOffset: -1,
          }}>
            {o.recommended && <span className="chip chip-orange" style={{ position: 'absolute', top: 12, right: 12 }}>가장 빠름</span>}
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: o.recommended ? 'var(--orange-2)' : 'var(--bg-3)',
              color: o.recommended ? '#fff' : 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}><Icon name={o.icon} size={18} /></div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{o.title}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{o.desc}</div>
          </button>
        ))}
      </div>

      {/* Expanded GitHub picker */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <Icon name="github" size={16} color="var(--text-primary)" />
          <span style={{ fontSize: 13, fontWeight: 700 }}>GitHub 레포 선택</span>
          <span className="chip chip-low">연결됨</span>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>jimin@github.com</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>레포</label>
            <div style={{
              padding: '8px 10px', background: 'var(--bg-3)', border: '1px solid var(--border)',
              borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <Icon name="github" size={12} color="var(--text-secondary)" />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>jimin/shop-api</span>
              <span className="chip" style={{ height: 16, fontSize: 8 }}>Private</span>
              <div style={{ flex: 1 }} />
              <Icon name="chevronDown" size={11} color="var(--text-tertiary)" />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>브랜치</label>
            <div style={{
              padding: '8px 10px', background: 'var(--bg-3)', border: '1px solid var(--border)',
              borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <Icon name="branch" size={12} color="var(--text-secondary)" />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>main</span>
              <div style={{ flex: 1 }} />
              <Icon name="chevronDown" size={11} color="var(--text-tertiary)" />
            </div>
          </div>
        </div>

        {/* Auto-recommended file filters */}
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>파일 필터</label>
            <span className="chip chip-orange" style={{ height: 18, fontSize: 9 }}>
              <Icon name="sparkle" size={9} />AI 자동 추천
            </span>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
              <Icon name="alert" size={10} style={{ verticalAlign: '-1px', marginRight: 4 }} />
              나중에 분석 설정에서 수정 가능
            </span>
          </div>

          {/* Filter chips with × to remove + add button */}
          <div style={{
            padding: 10, background: 'var(--bg-3)', border: '1px solid var(--border)',
            borderRadius: 6, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center',
          }}>
            {[
              { label: 'src/**/*.ts', recommended: true },
              { label: 'src/**/*.tsx', recommended: true },
              { label: 'api/**', recommended: true },
              { label: '!node_modules', exclude: true, recommended: true },
              { label: '!*.test.ts', exclude: true, recommended: true },
              { label: '!dist/**', exclude: true, recommended: true },
            ].map((f, i) => (
              <span key={i} className={f.exclude ? 'chip' : 'chip chip-orange'} style={{
                cursor: 'default', height: 26, padding: '0 4px 0 10px', fontSize: 11,
                display: 'inline-flex', alignItems: 'center', gap: 4,
                ...(f.exclude ? { color: 'var(--text-tertiary)', borderColor: 'var(--border)' } : {}),
              }}>
                {f.recommended && <Icon name="sparkle" size={8} color={f.exclude ? 'var(--text-tertiary)' : 'var(--orange)'} />}
                <span style={{ fontFamily: 'var(--font-mono)' }}>{f.label}</span>
                <button title="제거" style={{ width: 16, height: 16, borderRadius: 3, border: 'none', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 2 }}>
                  <Icon name="x" size={10} />
                </button>
              </span>
            ))}
            <button style={{
              height: 26, padding: '0 10px',
              background: 'transparent', border: '1px dashed var(--border-2)', borderRadius: 4,
              color: 'var(--text-secondary)', cursor: 'pointer',
              fontSize: 11, fontWeight: 600,
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}>
              <Icon name="plus" size={10} />필터 추가
            </button>
          </div>

          <div style={{ marginTop: 8, fontSize: 10, color: 'var(--text-tertiary)' }}>
            AI가 프로젝트 유형(서버/API)을 기준으로 추천한 필터입니다. <span style={{ color: 'var(--orange)' }}>×</span> 로 제거하거나 <strong style={{ color: 'var(--text-secondary)' }}>+ 필터 추가</strong>로 더할 수 있어요.
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
        <button className="btn"><Icon name="arrowLeft" size={11} stroke={2.2} />이전</button>
        <button className="btn btn-primary">다음 — 분석 시작 <Icon name="arrowRight" size={11} stroke={2.2} /></button>
      </div>
    </div>
  );
}

// ─── Step 3: Start first scan — with skip option ───────────
function OnboardStep3() {
  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 10 }}>
        검토 후 분석을 시작하세요
      </h1>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 32 }}>
        SAST → DAST → AI 패치 순서로 진행됩니다. 평균 3-5분 소요.<br />
        지금 분석하지 않고 <strong>에디터부터 둘러볼 수도 있어요</strong>.
      </p>

      <div className="card" style={{ padding: 24, marginBottom: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { label: '프로젝트', value: 'shop-api · 서버/API', icon: 'folder' },
            { label: '소스', value: 'jimin/shop-api · main', icon: 'github' },
            { label: '파일 필터', value: 'src/**/*.ts, api/** 외 5개', icon: 'filter' },
            { label: '팀', value: '@seohyun · kim@example.com (초대 발송)', icon: 'users' },
            { label: 'AI 모델', value: 'Haiku 4.5 · 5크레딧/파일', icon: 'sparkle' },
            { label: '예상 분석', value: '28개 파일 · 약 140 크레딧 · 3-5분', icon: 'cpu' },
          ].map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '4px 0' }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--bg-3)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={r.icon} size={13} />
              </div>
              <span style={{ width: 120, fontSize: 11, color: 'var(--text-tertiary)' }}>{r.label}</span>
              <span className="mono" style={{ fontSize: 12, color: 'var(--text-primary)', flex: 1 }}>{r.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{
        padding: '14px 16px', borderRadius: 8,
        background: 'var(--info-dim)', border: '1px solid rgba(86,156,214,0.30)',
        display: 'flex', gap: 12, marginBottom: 24,
      }}>
        <Icon name="alert" size={16} color="var(--info)" style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          DAST 테스트는 실제 HTTP 요청을 보냅니다. <strong>분석 중 도메인 소유 확인이 요구</strong>되며,
          확인 후 익스플로잇 검증이 진행됩니다.
        </div>
      </div>

      {/* CTA row — back + skip + primary */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="btn"><Icon name="arrowLeft" size={11} stroke={2.2} />이전</button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button title="분석은 나중에 — 에디터부터 둘러보기" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            height: 36, padding: '0 18px',
            border: '1px solid var(--border-2)',
            borderRadius: 8,
            background: 'var(--bg-2)',
            color: 'var(--text-primary)',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
            <Icon name="code" size={12} />
            에디터로 바로 가기 (분석 스킵)
          </button>
          <button className="btn btn-primary btn-lg">
            <Icon name="play" size={12} fill="currentColor" />첫 분석 시작
          </button>
        </div>
      </div>

      <div style={{ marginTop: 14, fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'right' }}>
        스킵해도 언제든 상단 <span className="chip chip-orange" style={{ height: 18, fontSize: 9 }}><Icon name="play" size={8} fill="currentColor" />분석 시작</span> 버튼으로 분석 가능
      </div>
    </div>
  );
}

// ─── Combined onboarding artboard ────────────────────────────
function OnboardingFull({ width = 1100, height = 800, step = 1 }) {
  return (
    <WindowChrome width={width} height={height} title="Pagori · 시작하기">
      <OnboardingShell step={step}>
        {step === 1 && <OnboardStep1 />}
        {step === 2 && <OnboardStep2 />}
        {step === 3 && <OnboardStep3 />}
      </OnboardingShell>
    </WindowChrome>
  );
}

Object.assign(window, { OnboardingFull, OnboardStep1, OnboardStep2, OnboardStep3 });
