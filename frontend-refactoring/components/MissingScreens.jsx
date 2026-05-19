/* global React, Icon, Chip, WindowChrome, SEV_META, MOCK_VULNS, PagoriLockup, PagoriMark */
// MissingScreens.jsx — 3 brand-new screens that weren't designed yet:
//   • GitHub 레포 스캔 설정 (full configuration page)
//   • 커밋 시크릿 스캔 (range selector + live progress + findings)
//   • PDF 리포트 생성·다운로드 (modal flow)

// ─── App chrome reused by GitHub scan + Commit scan screens ──
function FullScreenHeader({ icon = 'github', title = '레포 스캔', subtitle, action }) {
  return (
    <div style={{
      height: 56, flexShrink: 0,
      background: 'var(--bg-1)',
      borderBottom: '1px solid var(--hairline)',
      display: 'flex', alignItems: 'center', padding: '0 24px', gap: 14,
    }}>
      <button style={{
        width: 32, height: 32, borderRadius: 7, border: '1px solid var(--border)',
        background: 'var(--bg-2)', color: 'var(--text-secondary)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name="arrowLeft" size={13} />
      </button>
      <PagoriLockup size={22} />
      <div style={{ width: 1, height: 18, background: 'var(--hairline)' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 6,
          background: 'var(--orange-dim)', color: 'var(--orange)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><Icon name={icon} size={14} /></div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{title}</div>
          {subtitle && <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>{subtitle}</div>}
        </div>
      </div>
      <div style={{ flex: 1 }} />
      {action}
    </div>
  );
}

// ─── Section card with header ────────────────────────────────
function PageSection({ title, hint, action, children }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em' }}>{title}</h3>
        {hint && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{hint}</span>}
        <div style={{ flex: 1 }} />
        {action}
      </div>
      {children}
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════
// GITHUB REPO SCAN — full configuration page
// ═════════════════════════════════════════════════════════════════════
function GithubScanFlow({ width = 1200, height = 820 }) {
  return (
    <WindowChrome width={width} height={height} title="Pagori · GitHub 레포 스캔">
      <FullScreenHeader
        icon="github"
        title="GitHub 레포 스캔"
        subtitle="새 레포를 연동하고 스캔을 시작합니다"
        action={
          <>
            <button className="btn btn-sm btn-ghost" style={{ color: 'var(--text-tertiary)' }}>나중에</button>
            <button className="btn btn-sm">Webhook 설정</button>
          </>
        }
      />

      <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg-0)' }}>
        <div style={{ maxWidth: 880, margin: '0 auto', padding: '32px 32px 56px', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* GitHub account connected card */}
          <div className="card" style={{
            padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
            background: 'linear-gradient(90deg, rgba(34,197,94,0.06), transparent)',
            border: '1px solid rgba(34,197,94,0.20)',
          }}>
            <Icon name="github" size={20} color="var(--text-primary)" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>GitHub 연동됨</div>
              <div className="mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>jimin@github.com · 12개 레포 접근 가능</div>
            </div>
            <span className="chip chip-low"><span className="severity-dot" style={{ background: 'var(--low)' }} />연결됨</span>
            <button className="btn btn-sm btn-ghost"><Icon name="settings" size={11} />설정</button>
          </div>

          {/* Repo + branch picker */}
          <PageSection title="레포 선택" hint="OAuth로 연동된 12개 중에서 선택">
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
              {/* Repo picker with search */}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                  borderBottom: '1px solid var(--hairline)',
                }}>
                  <Icon name="search" size={12} color="var(--text-tertiary)" />
                  <input
                    defaultValue="shop"
                    style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
                  />
                </div>
                {[
                  { name: 'jimin/shop-api', desc: 'Spring Boot · TypeScript', stars: 12, lang: 'TypeScript', active: true },
                  { name: 'jimin/shop-admin', desc: 'Next.js dashboard', stars: 4, lang: 'TypeScript' },
                  { name: 'jimin/shop-mobile', desc: 'React Native', stars: 2, lang: 'TypeScript' },
                ].map((r, i) => (
                  <div key={r.name} style={{
                    padding: '10px 14px',
                    display: 'flex', alignItems: 'center', gap: 10,
                    borderBottom: i < 2 ? '1px solid var(--hairline)' : 'none',
                    background: r.active ? 'var(--orange-dim)' : 'transparent',
                    borderLeft: r.active ? '2px solid var(--orange-2)' : '2px solid transparent',
                    cursor: 'pointer',
                  }}>
                    <Icon name="github" size={13} color={r.active ? 'var(--orange)' : 'var(--text-secondary)'} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{r.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{r.desc}</div>
                    </div>
                    <span className="chip" style={{ height: 18, fontSize: 9 }}>{r.lang}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Icon name="star" size={9} />{r.stars}
                    </span>
                  </div>
                ))}
              </div>

              {/* Branch picker */}
              <div className="card" style={{ padding: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>브랜치</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {[
                    { name: 'main', active: true, head: '2분 전 · jimin', commits: 142 },
                    { name: 'develop', head: '어제 · seohyun', commits: 158 },
                    { name: 'feature/oauth', head: '3일 전 · seohyun', commits: 12 },
                  ].map(b => (
                    <div key={b.name} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '6px 8px', borderRadius: 5,
                      background: b.active ? 'var(--orange-dim)' : 'transparent',
                      cursor: 'pointer',
                    }}>
                      <Icon name="branch" size={11} color={b.active ? 'var(--orange)' : 'var(--text-tertiary)'} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="mono" style={{ fontSize: 11, fontWeight: 600 }}>{b.name}</div>
                        <div style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{b.head}</div>
                      </div>
                      <span style={{ fontSize: 9, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{b.commits}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </PageSection>

          {/* File filter */}
          <PageSection
            title="파일 필터"
            hint="AI 자동 추천 — 언제든 수정 가능"
            action={
              <span className="chip chip-orange" style={{ height: 20 }}>
                <Icon name="sparkle" size={9} />AI 추천
              </span>
            }
          >
            <div className="card" style={{ padding: 14, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
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
                  <span className="mono">{f.label}</span>
                  <Icon name="x" size={10} color="var(--text-tertiary)" />
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
          </PageSection>

          {/* Pipeline options */}
          <PageSection title="분석 파이프라인" hint="모듈 선택 — 비활성도 가능">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {[
                { id:'sast', label:'SAST', desc:'정적 분석 · 28파일 · 3분', active: true, color: 'var(--low)' },
                { id:'dast', label:'DAST', desc:'동적 분석 · 도메인 검증 필요', active: true, color: 'var(--orange)' },
                { id:'patch', label:'AI 패치', desc:'자동 수정 제안 생성', active: true, color: 'var(--tag-1)' },
              ].map(p => (
                <div key={p.id} style={{
                  padding: 14, borderRadius: 8,
                  background: p.active ? 'var(--bg-2)' : 'var(--bg-3)',
                  border: `1px solid ${p.active ? p.color : 'var(--border)'}`,
                  opacity: p.active ? 1 : 0.6,
                  display: 'flex', alignItems: 'center', gap: 10,
                  cursor: 'pointer',
                }}>
                  <span className="severity-dot" style={{ background: p.color, width: 8, height: 8 }} />
                  <div style={{ flex: 1 }}>
                    <div className="mono" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', color: p.color }}>{p.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 3 }}>{p.desc}</div>
                  </div>
                  <span style={{
                    width: 28, height: 16, borderRadius: 8,
                    background: p.active ? p.color : 'var(--bg-3)',
                    border: p.active ? 'none' : '1px solid var(--border-2)',
                    position: 'relative', flexShrink: 0,
                  }}>
                    <span style={{
                      position: 'absolute', top: 1, left: p.active ? 13 : 1,
                      width: 12, height: 12, borderRadius: 6,
                      background: '#fff',
                      transition: 'left 0.15s',
                    }} />
                  </span>
                </div>
              ))}
            </div>
          </PageSection>

          {/* Commit secret scan options */}
          <PageSection title="커밋 시크릿 스캔" hint="Git 히스토리에서 노출된 시크릿 탐지">
            <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Icon name="key" size={16} color="var(--orange)" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>커밋 스캔 실행</div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>스캔 후 별도 화면에서 결과 검토</div>
                </div>
                <span style={{
                  width: 32, height: 18, borderRadius: 9,
                  background: 'var(--orange-2)', position: 'relative', flexShrink: 0,
                }}>
                  <span style={{ position: 'absolute', top: 2, left: 16, width: 14, height: 14, borderRadius: 7, background: '#fff' }} />
                </span>
              </div>

              {/* Depth radio cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <label style={{
                  padding: 12, borderRadius: 8,
                  background: 'var(--bg-3)', border: '1px solid var(--border)',
                  cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 10,
                }}>
                  <span style={{
                    width: 14, height: 14, borderRadius: 7, marginTop: 2,
                    border: '1.5px solid var(--border-3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: 3, background: 'transparent' }} />
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>빠른 스캔</div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 3, lineHeight: 1.5 }}>
                      유출 확률이 높은 파일만 검사<br/>
                      <span className="mono">.env, config, secrets/, *.key</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                      <span className="chip" style={{ height: 18, fontSize: 9 }}>약 8 크레딧</span>
                      <span className="chip" style={{ height: 18, fontSize: 9 }}>~30초</span>
                    </div>
                  </div>
                </label>

                <label style={{
                  padding: 12, borderRadius: 8,
                  background: 'var(--orange-dim)', border: '1px solid rgba(249,115,22,0.40)',
                  cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 10,
                  outline: '2px solid var(--orange-2)', outlineOffset: -1,
                }}>
                  <span style={{
                    width: 14, height: 14, borderRadius: 7, marginTop: 2,
                    border: '1.5px solid var(--orange-2)', background: 'var(--orange-2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: 3, background: '#fff' }} />
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                      전수 검사
                      <span className="chip chip-orange" style={{ height: 16, fontSize: 8 }}>권장</span>
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 3, lineHeight: 1.5 }}>
                      모든 커밋의 모든 파일을 검사<br/>
                      과거 시크릿 누락 없음
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                      <span className="chip chip-orange" style={{ height: 18, fontSize: 9 }}>약 42 크레딧</span>
                      <span className="chip" style={{ height: 18, fontSize: 9 }}>~3분</span>
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </PageSection>

          {/* AI Model selection */}
          <PageSection title="AI 분석 모델" hint="분석 정확도와 크레딧 비용은 모델에 따라 달라집니다">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {[
                { id:'haiku', label:'Haiku 4.5', sub:'빠름 · 28파일 · 약 140 크레딧', desc:'대부분의 패턴 탐지', recommended: true, time: '3-5분' },
                { id:'sonnet', label:'Sonnet 4.5', sub:'균형 · 28파일 · 약 420 크레딧', desc:'복잡한 호출 체인 추적', time: '8-12분' },
                { id:'opus', label:'Opus 4', sub:'정확 · 28파일 · 약 2,100 크레딧', desc:'드문 패턴까지 추론', time: '20-30분' },
              ].map((m) => (
                <label key={m.id} style={{
                  textAlign: 'left', padding: 14, borderRadius: 8,
                  background: m.recommended ? 'var(--orange-dim)' : 'var(--bg-3)',
                  border: `1px solid ${m.recommended ? 'rgba(249,115,22,0.45)' : 'var(--border)'}`,
                  cursor: 'pointer', position: 'relative',
                  display: 'flex', flexDirection: 'column', gap: 4,
                  outline: m.recommended ? '1.5px solid var(--orange-2)' : 'none', outlineOffset: -1,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{
                      width: 14, height: 14, borderRadius: 7,
                      border: `1.5px solid ${m.recommended ? 'var(--orange-2)' : 'var(--border-3)'}`,
                      background: m.recommended ? 'var(--orange-2)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      {m.recommended && <span style={{ width: 6, height: 6, borderRadius: 3, background: '#fff' }} />}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{m.label}</span>
                    {m.recommended && <span style={{ marginLeft: 'auto', fontSize: 8, fontWeight: 700, color: 'var(--orange)', letterSpacing: '0.05em', fontFamily: 'var(--font-mono)' }}>추천</span>}
                  </div>
                  <div className="mono" style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{m.sub}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>{m.desc}</div>
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--hairline)', display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                    <span style={{ color: 'var(--text-tertiary)' }}>예상 소요</span>
                    <span className="mono" style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{m.time}</span>
                  </div>
                </label>
              ))}
            </div>
          </PageSection>

          {/* Estimate */}
          <div className="card" style={{
            padding: 16, background: 'var(--bg-2)',
            display: 'flex', alignItems: 'center', gap: 16,
            border: '1px solid var(--orange)',
          }}>
            <Icon name="cpu" size={22} color="var(--orange)" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>예상 분석</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>
                <span className="mono">28</span>개 파일 · 약 <span className="mono">140</span> 크레딧 · <span className="mono">3-5</span>분
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>잔여 크레딧</div>
              <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: 'var(--low)' }}>1,240</div>
            </div>
          </div>

          {/* CTA */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <button className="btn btn-ghost" style={{ color: 'var(--text-tertiary)' }}>취소</button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn"><Icon name="history" size={11} />스캔 이력</button>
              <button title="스캔 없이 클론 후 에디터로 이동" className="btn btn-lg">
                <Icon name="code" size={12} />에디터로 (스킵)
              </button>
              <button className="btn btn-primary btn-lg"><Icon name="play" size={12} fill="currentColor" />스캔 시작</button>
            </div>
          </div>
          <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'right' }}>
            <strong style={{ color: 'var(--text-secondary)' }}>스킵</strong> 시 레포가 클론되어 에디터에서 코드만 확인할 수 있고, 분석은 언제든 다시 시작할 수 있어요.
          </div>
        </div>
      </div>
    </WindowChrome>
  );
}

// ═════════════════════════════════════════════════════════════════════
// COMMIT SECRET SCAN — range selector + live progress + findings
// ═════════════════════════════════════════════════════════════════════
function CommitSecretScan({ width = 1200, height = 820 }) {
  const secrets = [
    { id:'s1', type:'AWS Access Key', commit:'a3f1c0e', author:'jimin', date:'5월 12일', file:'lib/config.ts', line:18, value:'AKIA****************', severity:'critical', verified: true },
    { id:'s2', type:'GitHub Personal Token', commit:'e8b2d54', author:'seohyun', date:'5월 10일', file:'scripts/deploy.sh', line:42, value:'ghp_****************', severity:'critical', verified: true },
    { id:'s3', type:'Database URL with password', commit:'c4a7f29', author:'jimin', date:'5월 8일', file:'.env.example', line:5, value:'postgresql://admin:p********@db.prod.com:5432/shop', severity:'high', verified: false },
    { id:'s4', type:'Generic API Key', commit:'b1f9c33', author:'jimin', date:'5월 5일', file:'lib/sentry.ts', line:3, value:'sk_live_****************', severity:'high', verified: true },
    { id:'s5', type:'Slack Webhook URL', commit:'7d8e21a', author:'kim', date:'5월 3일', file:'docs/README.md', line:127, value:'https://hooks.slack.com/services/T0****/B0****/****', severity:'medium', verified: false },
  ];

  return (
    <WindowChrome width={width} height={height} title="Pagori · 커밋 시크릿 스캔">
      <FullScreenHeader
        icon="key"
        title="커밋 시크릿 스캔"
        subtitle="shop-api · main · Git 히스토리에서 시크릿 탐지"
        action={
          <>
            <button className="btn btn-sm"><Icon name="download" size={11} />결과 내보내기</button>
            <button className="btn btn-sm btn-primary"><Icon name="refresh" size={11} />재스캔</button>
          </>
        }
      />

      <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg-0)' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '24px 24px 48px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Range selector */}
          <PageSection title="스캔 범위" hint="커밋 범위를 선택하세요">
            <div className="card" style={{ padding: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ display: 'flex', height: 32, padding: 2, background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 7 }}>
                {[
                  { id:'last', label:'최근 N개' },
                  { id:'date', label:'날짜 범위', active: true },
                  { id:'commit', label:'커밋 SHA 범위' },
                  { id:'all', label:'전체 히스토리' },
                ].map(o => (
                  <button key={o.id} style={{
                    padding: '0 14px', borderRadius: 5, border: 'none',
                    background: o.active ? 'var(--bg-1)' : 'transparent',
                    color: o.active ? 'var(--text-primary)' : 'var(--text-tertiary)',
                    fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    boxShadow: o.active ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
                  }}>{o.label}</button>
                ))}
              </div>
              <div style={{ width: 1, height: 22, background: 'var(--hairline)' }} />
              {/* date inputs */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
                <span>From</span>
                <input className="field" style={{ height: 28, width: 110, fontSize: 11 }} defaultValue="2026-05-01" />
                <Icon name="arrowRight" size={11} color="var(--text-tertiary)" />
                <input className="field" style={{ height: 28, width: 110, fontSize: 11 }} defaultValue="2026-05-17" />
              </div>
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                <span className="mono" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>42</span>개 커밋이 범위에 포함됩니다
              </span>
            </div>
          </PageSection>

          {/* Live progress */}
          <div className="card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <span className="severity-dot" style={{ background: 'var(--orange)', animation: 'pulse-dot 1.4s infinite', width: 8, height: 8 }} />
              <span style={{ fontSize: 13, fontWeight: 700 }}>스캔 중</span>
              <span className="chip chip-orange" style={{ height: 18 }}>5개 시크릿 탐지</span>
              <div style={{ flex: 1 }} />
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>32 / 42 커밋 · 약 1분 남음</span>
              <button className="btn btn-sm btn-ghost" style={{ color: 'var(--text-tertiary)' }}>
                <Icon name="pause" size={10} />일시정지
              </button>
            </div>
            <div className="progress-track" style={{ height: 4 }}>
              <div className="progress-fill" style={{ width: '76%' }} />
            </div>
            <div style={{ marginTop: 10, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>
              현재: <span style={{ color: 'var(--text-secondary)' }}>커밋 c4a7f29 · .env.example</span>
            </div>
          </div>

          {/* Findings table */}
          <PageSection
            title="탐지된 시크릿"
            hint={`${secrets.length}개 — 모두 검토 후 처리 필요`}
            action={
              <div style={{ display: 'flex', gap: 6 }}>
                <Chip tone="critical" active>CRITICAL 2</Chip>
                <Chip tone="high" active>HIGH 2</Chip>
                <Chip tone="medium" active>MEDIUM 1</Chip>
                <span style={{ width: 1, alignSelf: 'stretch', background: 'var(--hairline)' }} />
                <Chip tone="low">검증됨 3</Chip>
                <Chip>미검증 2</Chip>
              </div>
            }
          >
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '24px 1.4fr 1fr 1.6fr 1.6fr 1fr',
                gap: 14, padding: '10px 18px',
                fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)',
                background: 'var(--bg-2)',
                borderBottom: '1px solid var(--hairline)',
              }}>
                <span></span>
                <span>시크릿 유형</span>
                <span>커밋</span>
                <span>파일</span>
                <span>값 (마스킹됨)</span>
                <span style={{ textAlign: 'right' }}>액션</span>
              </div>

              {secrets.map((s, i) => (
                <div key={s.id} style={{
                  display: 'grid',
                  gridTemplateColumns: '24px 1.4fr 1fr 1.6fr 1.6fr 1fr',
                  gap: 14, padding: '14px 18px',
                  alignItems: 'center', fontSize: 12,
                  borderBottom: i === secrets.length - 1 ? 'none' : '1px solid var(--hairline)',
                }}>
                  <span className="severity-dot" style={{ background: SEV_META[s.severity].color, boxShadow: s.severity === 'critical' ? `0 0 6px ${SEV_META[s.severity].color}` : 'none' }} />
                  <div>
                    <div style={{ fontWeight: 600 }}>{s.type}</div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                      <span className={`chip chip-${s.severity}`} style={{ height: 16, fontSize: 8 }}>{SEV_META[s.severity].label}</span>
                      {s.verified
                        ? <span className="chip chip-critical" style={{ height: 16, fontSize: 8 }}>API 검증됨</span>
                        : <span className="chip" style={{ height: 16, fontSize: 8 }}>미검증</span>}
                    </div>
                  </div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    <div>{s.commit}</div>
                    <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 2 }}>{s.author} · {s.date}</div>
                  </div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    {s.file}
                    <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 2 }}>line {s.line}</div>
                  </div>
                  <div style={{
                    padding: '6px 10px',
                    background: 'var(--bg-0)',
                    border: '1px solid var(--border)',
                    borderRadius: 5,
                    fontFamily: 'var(--font-mono)', fontSize: 10,
                    color: 'var(--text-secondary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{s.value}</div>
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                    <button title="허용 목록 추가" className="btn btn-sm btn-ghost" style={{ height: 22, width: 22, padding: 0, justifyContent: 'center' }}><Icon name="check" size={10} /></button>
                    <button title="Git 정리 가이드" className="btn btn-sm" style={{ height: 22, background: 'var(--critical-dim)', borderColor: 'rgba(240,65,65,0.30)', color: 'var(--critical)' }}>
                      <Icon name="zap" size={10} />정리
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </PageSection>

          {/* Warning box */}
          <div style={{
            padding: '14px 18px', borderRadius: 8,
            background: 'var(--critical-dim)', border: '1px solid rgba(240,65,65,0.30)',
            display: 'flex', gap: 12,
          }}>
            <Icon name="alert" size={16} color="var(--critical)" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--text-primary)' }}>검증된 시크릿</strong>은 실제 외부 API와 통신이 가능합니다 — 즉시 발급사에서 폐기하세요.
              그 후 Git 히스토리에서 제거(rewrite)해야 완전히 사라집니다.
              <button className="btn btn-sm btn-ghost" style={{ height: 22, marginLeft: 8, color: 'var(--critical)' }}>전체 정리 가이드 보기 →</button>
            </div>
          </div>
        </div>
      </div>
    </WindowChrome>
  );
}

// ═════════════════════════════════════════════════════════════════════
// PDF REPORT MODAL — generate + download flow
// ═════════════════════════════════════════════════════════════════════
function PdfReportModal({ width = 1100, height = 720, state = 'configure' }) {
  return (
    <WindowChrome width={width} height={height} title="Pagori · PDF 리포트">
      {/* Dimmed dashboard behind */}
      <div style={{ flex: 1, position: 'relative', background: 'var(--bg-0)', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.25,
          padding: 24, display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div style={{ height: 48, background: 'var(--bg-1)', borderRadius: 8 }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
            {[1,2,3,4,5].map(i => <div key={i} style={{ height: 80, background: 'var(--bg-2)', borderRadius: 8 }} />)}
          </div>
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ background: 'var(--bg-2)', borderRadius: 8 }} />
            <div style={{ background: 'var(--bg-2)', borderRadius: 8 }} />
          </div>
        </div>
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(2px)' }} />

        {/* Modal */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          width: 560,
          background: 'var(--bg-1)',
          border: '1px solid var(--border-2)',
          borderRadius: 14,
          boxShadow: '0 24px 64px rgba(0,0,0,0.60)',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '18px 24px', display: 'flex', alignItems: 'center', gap: 12,
            borderBottom: '1px solid var(--hairline)',
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: 'var(--orange-dim)', color: 'var(--orange)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name="fileText" size={18} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>PDF 보안 리포트</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>shop-api · 5월 17일 분석 기준</div>
            </div>
            <button style={{ width: 24, height: 24, borderRadius: 5, border: 'none', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer' }}>
              <Icon name="x" size={13} />
            </button>
          </div>

          {state === 'configure' && (
            <div style={{ padding: '20px 24px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em', marginBottom: 10 }}>포함할 섹션</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
                {[
                  { label: '경영진 요약 (Hero score + 우선순위)', checked: true },
                  { label: '심각도별 분포 + 트렌드 차트', checked: true },
                  { label: 'OWASP Top 10 커버리지 매트릭스', checked: true },
                  { label: '파일별 핫스팟 히트맵', checked: true },
                  { label: '취약점 전체 상세 (10건)', checked: true },
                  { label: 'AI 패치 제안 코드 (10건)', checked: true },
                  { label: 'SBOM & CVE 부록', checked: false },
                  { label: 'DAST 실행 로그', checked: false },
                ].map((opt, i) => (
                  <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', borderRadius: 5, cursor: 'pointer', background: opt.checked ? 'var(--bg-2)' : 'transparent' }}>
                    <span style={{
                      width: 16, height: 16, borderRadius: 4,
                      border: `1.5px solid ${opt.checked ? 'var(--orange-2)' : 'var(--border-3)'}`,
                      background: opt.checked ? 'var(--orange-2)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>{opt.checked && <Icon name="check" size={10} color="#fff" stroke={3} />}</span>
                    <span style={{ fontSize: 12, flex: 1 }}>{opt.label}</span>
                  </label>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em', marginBottom: 6 }}>언어</div>
                  <select className="field" defaultValue="ko">
                    <option value="ko">한국어</option>
                    <option value="en">English</option>
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em', marginBottom: 6 }}>형식</div>
                  <select className="field" defaultValue="pdf">
                    <option value="pdf">PDF</option>
                    <option value="html">HTML</option>
                    <option value="md">Markdown</option>
                  </select>
                </div>
              </div>

              <div style={{
                padding: 12, background: 'var(--bg-3)', borderRadius: 8,
                display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
              }}>
                <Icon name="lock" size={14} color="var(--text-secondary)" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>다운로드 토큰</div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>30분간 유효한 보안 토큰으로 다운로드</div>
                </div>
                <span className="chip chip-low" style={{ height: 18 }}>활성</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <button className="btn btn-ghost" style={{ color: 'var(--text-tertiary)' }}>취소</button>
                <button className="btn btn-primary"><Icon name="fileText" size={11} />리포트 생성</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </WindowChrome>
  );
}

function PdfReportProgress({ width = 1100, height = 720 }) {
  return (
    <WindowChrome width={width} height={height} title="Pagori · PDF 리포트 — 생성 완료">
      <div style={{ flex: 1, position: 'relative', background: 'var(--bg-0)', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(2px)' }} />

        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          width: 480,
          background: 'var(--bg-1)',
          border: '1px solid var(--border-2)',
          borderRadius: 14,
          boxShadow: '0 24px 64px rgba(0,0,0,0.60)',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '28px 24px 20px', textAlign: 'center' }}>
            <div style={{
              width: 64, height: 64, borderRadius: 14, margin: '0 auto 14px',
              background: 'linear-gradient(135deg, var(--orange), var(--orange-2))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(234,88,12,0.40)',
            }}>
              <Icon name="check" size={28} color="#fff" stroke={2.6} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 6 }}>
              리포트가 생성되었습니다
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              42페이지 · 1.8 MB · pagori-shop-api-2026-05-17.pdf
            </div>
          </div>

          <div style={{ padding: '0 24px 18px' }}>
            <div style={{
              padding: 14, borderRadius: 8,
              background: 'var(--bg-3)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <Icon name="fileText" size={20} color="var(--orange)" />
              <div style={{ flex: 1 }}>
                <div className="mono" style={{ fontSize: 11, fontWeight: 600 }}>pagori-shop-api-2026-05-17.pdf</div>
                <div style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>토큰 만료 27분 후 · 처음 다운로드 시 토큰 1회 소진</div>
              </div>
              <button className="btn btn-primary"><Icon name="download" size={12} />다운로드</button>
            </div>
          </div>

          <div style={{
            padding: '12px 24px',
            background: 'var(--bg-2)',
            borderTop: '1px solid var(--hairline)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
          }}>
            <button className="btn btn-sm btn-ghost"><Icon name="copy" size={11} />링크 복사</button>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-sm btn-ghost"><Icon name="mail" size={11} />이메일 전송</button>
              <button className="btn btn-sm">닫기</button>
            </div>
          </div>
        </div>
      </div>
    </WindowChrome>
  );
}

Object.assign(window, { GithubScanFlow, CommitSecretScan, PdfReportModal, PdfReportProgress });
