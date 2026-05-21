/* global React, Icon, Chip, WindowChrome, SEV_META, MOCK_NOTIFICATIONS, MOCK_VULNS, MOCK_FILES, PagoriLockup */
// EmptyStates.jsx + CmdK overlay + Notification panel + Resume modal.

// ─── Single empty-state card primitive ───────────────────────
function EmptyCard({ width = 320, height = 280, illustration, eyebrow, title, body, actions, dark = true }) {
  return (
    <div style={{
      width, height,
      background: 'var(--bg-1)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: 28,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      textAlign: 'center', gap: 14,
      overflow: 'hidden', position: 'relative',
    }}>
      {illustration}
      {eyebrow && (
        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.10em', fontFamily: 'var(--font-mono)' }}>
          {eyebrow}
        </div>
      )}
      <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>{title}</div>
      {body && <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55, maxWidth: 240 }}>{body}</div>}
      {actions && <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>{actions}</div>}
    </div>
  );
}

// ─── Illustration: layered geometric shapes ──────────────────
function FirstProjectIllo() {
  return (
    <svg width="88" height="80" viewBox="0 0 88 80" fill="none">
      {/* Stacked papers */}
      <rect x="10" y="22" width="58" height="48" rx="8" fill="var(--bg-3)" stroke="var(--border-2)" strokeWidth="1" />
      <rect x="18" y="14" width="58" height="48" rx="8" fill="var(--bg-2)" stroke="var(--border-2)" strokeWidth="1" />
      <rect x="26" y="6" width="58" height="48" rx="8" fill="var(--orange-dim)" stroke="var(--orange)" strokeWidth="1.5" />
      <path d="M55 30 L55 38 M51 34 L59 34" stroke="var(--orange)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function NoVulnsIllo() {
  return (
    <svg width="88" height="80" viewBox="0 0 88 80" fill="none">
      <circle cx="44" cy="40" r="34" fill="rgba(34,197,94,0.08)" stroke="rgba(34,197,94,0.30)" strokeWidth="1.5" strokeDasharray="3 3" />
      <circle cx="44" cy="40" r="20" fill="var(--low-dim)" stroke="var(--low)" strokeWidth="1.5" />
      <path d="M37 40 L42 45 L52 35" stroke="var(--low)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function ScanReadyIllo() {
  return (
    <svg width="88" height="80" viewBox="0 0 88 80" fill="none">
      <rect x="14" y="18" width="60" height="44" rx="6" fill="var(--bg-3)" stroke="var(--border-2)" strokeWidth="1" />
      <circle cx="22" cy="26" r="2" fill="var(--critical)" />
      <circle cx="29" cy="26" r="2" fill="var(--high)" />
      <circle cx="36" cy="26" r="2" fill="var(--low)" />
      <rect x="22" y="34" width="44" height="2" rx="1" fill="var(--border-2)" />
      <rect x="22" y="40" width="34" height="2" rx="1" fill="var(--border-2)" />
      <rect x="22" y="46" width="40" height="2" rx="1" fill="var(--border-2)" />
      <circle cx="62" cy="60" r="14" fill="var(--orange-2)" stroke="var(--bg-1)" strokeWidth="3" />
      <path d="M58 56 L67 60 L58 64 Z" fill="#fff" />
    </svg>
  );
}

function FilterEmptyIllo() {
  return (
    <svg width="88" height="80" viewBox="0 0 88 80" fill="none">
      <path d="M22 16 L66 16 L52 36 L52 56 L36 64 L36 36 Z" fill="var(--bg-3)" stroke="var(--border-2)" strokeWidth="1.5" />
      <circle cx="62" cy="62" r="12" fill="var(--bg-1)" stroke="var(--orange)" strokeWidth="2" />
      <path d="M56 62 L68 62 M62 56 L62 68" stroke="var(--orange)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SearchEmptyIllo() {
  return (
    <svg width="88" height="80" viewBox="0 0 88 80" fill="none">
      <circle cx="38" cy="36" r="20" fill="var(--bg-3)" stroke="var(--border-2)" strokeWidth="1.5" />
      <line x1="53" y1="51" x2="68" y2="66" stroke="var(--border-2)" strokeWidth="3" strokeLinecap="round" />
      <line x1="30" y1="36" x2="46" y2="36" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function OfflineIllo() {
  return (
    <svg width="88" height="80" viewBox="0 0 88 80" fill="none">
      <circle cx="44" cy="40" r="28" fill="var(--bg-3)" stroke="var(--border-2)" strokeWidth="1.5" />
      <path d="M30 40 Q44 28 58 40" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M36 46 Q44 40 52 46" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" fill="none" />
      <circle cx="44" cy="52" r="2.5" fill="var(--critical)" />
      <line x1="22" y1="18" x2="66" y2="62" stroke="var(--critical)" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

// ─── Collection artboard ─────────────────────────────────────
function EmptyStatesCollection({ width = 1100, height = 720 }) {
  return (
    <WindowChrome width={width} height={height} title="Pagori · Empty States · 6 variants">
      <div style={{ flex: 1, padding: 32, overflow: 'auto', background: 'var(--bg-0)' }}>
        <div style={{ maxWidth: 1040, margin: '0 auto' }}>
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>빈 상태 컬렉션</h2>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>각 상황에 맞는 6가지 빈 상태 — 일러스트, 카피, CTA를 통일된 시스템으로</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <EmptyCard
              illustration={<FirstProjectIllo />}
              eyebrow="첫 진입"
              title="첫 프로젝트를 만들어보세요"
              body="GitHub 레포 연결, 로컬 폴더 열기, ZIP 업로드 중 선택할 수 있어요."
              actions={
                <>
                  <button className="btn btn-primary btn-sm"><Icon name="plus" size={10} stroke={2.4} />프로젝트 생성</button>
                  <button className="btn btn-sm btn-ghost">샘플 보기</button>
                </>
              }
            />

            <EmptyCard
              illustration={<ScanReadyIllo />}
              eyebrow="스캔 전"
              title="첫 분석을 시작해주세요"
              body="SAST는 평균 3분, DAST는 추가 2분이 걸려요. 분석 중 작업은 계속할 수 있습니다."
              actions={
                <button className="btn btn-primary btn-sm"><Icon name="play" size={10} fill="currentColor" />분석 시작</button>
              }
            />

            <EmptyCard
              illustration={<NoVulnsIllo />}
              eyebrow="분석 완료"
              title="취약점이 발견되지 않았어요"
              body="훌륭합니다! 28개 파일을 모두 검사했지만 위험 요소가 없습니다."
              actions={
                <>
                  <button className="btn btn-sm"><Icon name="download" size={10} />리포트 받기</button>
                  <button className="btn btn-sm btn-ghost">다시 분석</button>
                </>
              }
            />

            <EmptyCard
              illustration={<FilterEmptyIllo />}
              eyebrow="필터 결과 없음"
              title="이 필터에 맞는 취약점이 없어요"
              body="CRITICAL · DAST_DONE 조합으로 검색했지만 일치하는 항목이 없습니다."
              actions={
                <button className="btn btn-sm"><Icon name="x" size={10} />필터 초기화</button>
              }
            />

            <EmptyCard
              illustration={<SearchEmptyIllo />}
              eyebrow="검색 결과 없음"
              title="'sqlinj'와 일치하는 항목이 없습니다"
              body="다른 키워드를 시도하거나 검색 범위를 확장해보세요."
              actions={
                <>
                  <button className="btn btn-sm btn-ghost">전체에서 검색</button>
                </>
              }
            />

            <EmptyCard
              illustration={<OfflineIllo />}
              eyebrow="연결 오류"
              title="AI 서버에 연결할 수 없어요"
              body="네트워크를 확인하거나 잠시 후 다시 시도해주세요. 지금 분석을 시작할 수는 없습니다."
              actions={
                <>
                  <button className="btn btn-primary btn-sm"><Icon name="refresh" size={10} />재시도</button>
                  <button className="btn btn-sm btn-ghost">상태 페이지</button>
                </>
              }
            />
          </div>
        </div>
      </div>
    </WindowChrome>
  );
}

// ─── Cmd+K palette overlay ───────────────────────────────────
function CmdKPalette({ width = 1100, height = 720 }) {
  const results = [
    {
      group: '취약점',
      items: [
        { tag:'CRITICAL', tagTone:'critical', title:'SQL Injection', sub:'api/users/route.ts:42 · CWE-89', meta:'EXPLOITED' },
        { tag:'CRITICAL', tagTone:'critical', title:'Hardcoded Secret', sub:'lib/config.ts:18 · CWE-798' },
        { tag:'HIGH', tagTone:'high', title:'XSS — Stored', sub:'components/comment.tsx:73 · CWE-79' },
      ],
    },
    {
      group: '파일',
      items: [
        { icon:'file', title:'api/users/route.ts', sub:'TypeScript · 1 vuln · 280 lines' },
        { icon:'file', title:'lib/config.ts', sub:'TypeScript · 1 vuln · 64 lines' },
      ],
    },
    {
      group: '액션',
      items: [
        { icon:'play', title:'분석 시작', sub:'shop-api · main · 28 파일', kbd: ['⌘', '⇧', 'A'] },
        { icon:'download', title:'PDF 리포트 다운로드', sub:'현재 분석 결과', kbd: ['⌘', '⇧', 'D'] },
        { icon:'github', title:'GitHub 레포 스캔', sub:'새 레포 추가하고 스캔' },
      ],
    },
  ];

  return (
    <WindowChrome width={width} height={height} title="Pagori · Cmd+K (전역 검색)">
      {/* Dimmed app behind */}
      <div style={{
        flex: 1, position: 'relative',
        background: 'var(--bg-0)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: 96,
      }}>
        {/* Faded app screenshot grid (simulated) */}
        <div style={{
          position: 'absolute', inset: 0,
          opacity: 0.3, filter: 'blur(2px)',
          padding: 24, display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div style={{ height: 36, background: 'var(--bg-2)', borderRadius: 8 }} />
          <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr 320px', gap: 12, flex: 1 }}>
            <div style={{ background: 'var(--bg-2)', borderRadius: 8 }} />
            <div style={{ background: 'var(--bg-2)', borderRadius: 8 }} />
            <div style={{ background: 'var(--bg-2)', borderRadius: 8 }} />
          </div>
        </div>

        {/* Backdrop scrim */}
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }} />

        {/* Palette */}
        <div style={{
          position: 'relative', width: 680, zIndex: 2,
          background: 'var(--bg-1)',
          border: '1px solid var(--border-2)',
          borderRadius: 12,
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          overflow: 'hidden',
        }}>
          {/* Input */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '16px 20px', borderBottom: '1px solid var(--hairline)',
          }}>
            <Icon name="search" size={16} color="var(--text-tertiary)" />
            <input
              autoFocus
              defaultValue="sql"
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                fontSize: 15, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)',
              }}
            />
            <span className="mono" style={{
              padding: '3px 6px', borderRadius: 4, background: 'var(--bg-3)',
              border: '1px solid var(--border)', fontSize: 9, fontWeight: 700,
              color: 'var(--text-tertiary)',
            }}>ESC</span>
          </div>

          {/* Filter scope chips */}
          <div style={{ padding: '10px 16px', display: 'flex', gap: 6, borderBottom: '1px solid var(--hairline)' }}>
            <Chip tone="orange" active>전체</Chip>
            <Chip>취약점 3</Chip>
            <Chip>파일 2</Chip>
            <Chip>CVE 0</Chip>
            <Chip>액션 3</Chip>
          </div>

          {/* Results */}
          <div style={{ maxHeight: 380, overflow: 'auto' }}>
            {results.map((g, gi) => (
              <div key={gi}>
                <div style={{
                  padding: '8px 16px', fontSize: 9, fontWeight: 700,
                  color: 'var(--text-tertiary)', letterSpacing: '0.08em',
                  fontFamily: 'var(--font-mono)',
                  background: 'var(--bg-2)',
                  borderTop: gi > 0 ? '1px solid var(--hairline)' : 'none',
                }}>{g.group.toUpperCase()}</div>
                {g.items.map((item, ii) => {
                  const selected = gi === 0 && ii === 0;
                  return (
                    <div key={ii} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 16px',
                      background: selected ? 'var(--orange-dim)' : 'transparent',
                      borderLeft: selected ? '2px solid var(--orange-2)' : '2px solid transparent',
                      cursor: 'pointer',
                    }}>
                      {item.tag ? (
                        <span className={`chip chip-${item.tagTone}`} style={{ width: 70, justifyContent: 'center' }}>
                          <span className="severity-dot" style={{ background: SEV_META[item.tagTone].color }} />
                          {item.tag}
                        </span>
                      ) : (
                        <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--bg-3)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Icon name={item.icon} size={13} />
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{item.title}</div>
                        <div className="mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{item.sub}</div>
                      </div>
                      {item.meta && <span className="chip chip-critical">{item.meta}</span>}
                      {item.kbd && (
                        <div style={{ display: 'flex', gap: 2 }}>
                          {item.kbd.map(k => (
                            <span key={k} className="mono" style={{ padding: '2px 5px', borderRadius: 3, background: 'var(--bg-3)', border: '1px solid var(--border)', fontSize: 9, fontWeight: 600, color: 'var(--text-tertiary)' }}>{k}</span>
                          ))}
                        </div>
                      )}
                      {selected && <Icon name="arrowRight" size={12} color="var(--text-tertiary)" />}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div style={{
            padding: '8px 16px', borderTop: '1px solid var(--hairline)',
            display: 'flex', alignItems: 'center', gap: 16,
            fontSize: 10, color: 'var(--text-tertiary)',
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span className="mono" style={{ padding: '2px 5px', borderRadius: 3, background: 'var(--bg-3)', border: '1px solid var(--border)', fontSize: 9 }}>↑↓</span> 이동
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span className="mono" style={{ padding: '2px 5px', borderRadius: 3, background: 'var(--bg-3)', border: '1px solid var(--border)', fontSize: 9 }}>↵</span> 열기
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span className="mono" style={{ padding: '2px 5px', borderRadius: 3, background: 'var(--bg-3)', border: '1px solid var(--border)', fontSize: 9 }}>⌘K</span> 단축키 도움말
            </span>
            <div style={{ flex: 1 }} />
            <span className="mono">8 results · 12ms</span>
          </div>
        </div>
      </div>
    </WindowChrome>
  );
}

// ─── Notification panel (header dropdown) ────────────────────
function NotificationCenter({ width = 1100, height = 720 }) {
  return (
    <WindowChrome width={width} height={height} title="Pagori · 알림 센터">
      <div style={{ flex: 1, background: 'var(--bg-0)', position: 'relative', display: 'flex', flexDirection: 'column' }}>
        {/* Fake header */}
        <div style={{
          height: 48, flexShrink: 0,
          background: 'var(--bg-1)',
          borderBottom: '1px solid var(--hairline)',
          display: 'flex', alignItems: 'center', padding: '0 24px',
        }}>
          <PagoriLockup size={20} />
          <div style={{ flex: 1 }} />
          <button style={{
            position: 'relative', width: 28, height: 28, borderRadius: 6,
            background: 'var(--orange-dim)', border: '1px solid var(--orange)',
            color: 'var(--orange)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', marginRight: 8,
          }}>
            <Icon name="bell" size={13} />
            <span style={{
              position: 'absolute', top: -3, right: -3,
              minWidth: 14, height: 14, borderRadius: 7,
              background: 'var(--orange-2)', color: '#fff',
              fontSize: 9, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 0 2px var(--bg-1)',
            }}>2</span>
          </button>
        </div>

        {/* Panel anchored to bell */}
        <div style={{ flex: 1, padding: '8px 24px 24px', position: 'relative' }}>
          <div style={{
            width: 380, marginLeft: 'auto', marginRight: 0,
            background: 'var(--bg-1)',
            border: '1px solid var(--border-2)',
            borderRadius: 10,
            boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
            overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{
              padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8,
              borderBottom: '1px solid var(--hairline)',
            }}>
              <Icon name="bell" size={13} color="var(--orange)" />
              <span style={{ fontSize: 13, fontWeight: 700 }}>알림</span>
              <span className="chip chip-orange" style={{ height: 18, fontSize: 9 }}>2 새로운</span>
              <div style={{ flex: 1 }} />
              <button className="btn btn-sm btn-ghost" style={{ height: 22, color: 'var(--text-tertiary)' }}>모두 읽음</button>
            </div>

            {/* Filter tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--hairline)' }}>
              {[
                { label: '전체', count: 4, active: true },
                { label: '분석', count: 1 },
                { label: 'CVE', count: 1 },
                { label: 'PR', count: 1 },
                { label: 'SLA', count: 1 },
              ].map((t) => (
                <button key={t.label} style={{
                  flex: 1, padding: '8px 0', border: 'none', background: 'transparent',
                  borderBottom: t.active ? '2px solid var(--orange-2)' : '2px solid transparent',
                  color: t.active ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                }}>
                  {t.label}
                  <span style={{ fontSize: 9, opacity: 0.7 }}>({t.count})</span>
                </button>
              ))}
            </div>

            {/* List */}
            <div style={{ maxHeight: 360, overflow: 'auto' }}>
              {MOCK_NOTIFICATIONS.map((n, i) => {
                const iconMap = { analysis_done: 'check', cve: 'alert', pr: 'github', sla: 'history' };
                const colorMap = { analysis_done: 'var(--low)', cve: 'var(--critical)', pr: 'var(--tag-1)', sla: 'var(--high)' };
                return (
                  <div key={n.id} style={{
                    padding: '12px 16px',
                    background: n.unread ? 'var(--surface-overlay)' : 'transparent',
                    borderBottom: i < MOCK_NOTIFICATIONS.length - 1 ? '1px solid var(--hairline)' : 'none',
                    display: 'flex', gap: 12, position: 'relative', cursor: 'pointer',
                  }}>
                    {n.unread && (
                      <span style={{
                        position: 'absolute', top: 16, left: 6,
                        width: 5, height: 5, borderRadius: '50%',
                        background: 'var(--orange-2)',
                      }} />
                    )}
                    <div style={{
                      width: 26, height: 26, borderRadius: 6,
                      background: `${colorMap[n.type]}1A`, color: colorMap[n.type],
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}><Icon name={iconMap[n.type]} size={12} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 3 }}>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{n.title}</span>
                        <span className="mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{n.time}</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{n.body}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--hairline)', textAlign: 'center' }}>
              <button className="btn btn-sm btn-ghost" style={{ color: 'var(--orange)' }}>
                모든 알림 보기 <Icon name="arrowRight" size={10} stroke={2.2} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </WindowChrome>
  );
}

// ─── Resume / Stop modal ─────────────────────────────────────
function ResumeModal({ width = 1100, height = 720 }) {
  return (
    <WindowChrome width={width} height={height} title="Pagori · 진행 중인 분석 발견">
      <div style={{
        flex: 1, position: 'relative', background: 'var(--bg-0)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}>
        {/* Faded backdrop */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.25,
          background: `
            linear-gradient(var(--bg-2), transparent 80%),
            repeating-linear-gradient(90deg, transparent 0, transparent 100px, var(--bg-2) 100px, var(--bg-2) 101px),
            repeating-linear-gradient(0deg, transparent 0, transparent 100px, var(--bg-2) 100px, var(--bg-2) 101px)
          `,
        }} />
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }} />

        {/* Modal */}
        <div style={{
          position: 'relative', zIndex: 2,
          width: 520,
          background: 'var(--bg-1)',
          border: '1px solid var(--border-2)',
          borderRadius: 14,
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '24px 24px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: 'var(--orange-dim)', color: 'var(--orange)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: 'pulse-dot 1.6s infinite',
              }}>
                <Icon name="alert" size={16} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--orange)', fontWeight: 700, letterSpacing: '0.06em', marginBottom: 2 }}>진행 중인 분석 발견</div>
                <h3 style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>어떻게 처리할까요?</h3>
              </div>
            </div>

            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>
              이 프로젝트에 13분 전 시작된 분석 세션이 있습니다. <strong>4/7 파일 완료</strong> 상태에서 멈췄어요.
              이어서 진행하거나 새로 시작할 수 있습니다.
            </p>

            <div style={{
              padding: 12, borderRadius: 8,
              background: 'var(--bg-3)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: 14,
              marginBottom: 14,
            }}>
              <div style={{ flex: 1 }}>
                <div className="mono" style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  세션 #2af1c0 · 13분 전 시작 · jimin@shop-api
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: '57%' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: 'var(--text-tertiary)' }}>
                  <span>4/7 파일</span>
                  <span>발견된 취약점 5건</span>
                  <span className="mono">62 크레딧 사용</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px', borderRadius: 8,
                background: 'var(--orange-dim)', border: '1px solid var(--orange)',
                color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left',
              }}>
                <Icon name="play" size={14} color="var(--orange)" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>이어서 진행 (권장)</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>남은 3개 파일만 분석 · 약 30 크레딧 추가</div>
                </div>
                <span className="chip chip-orange">⌘ R</span>
              </button>

              <button style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px', borderRadius: 8,
                background: 'var(--bg-3)', border: '1px solid var(--border)',
                color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left',
              }}>
                <Icon name="refresh" size={14} color="var(--text-secondary)" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>새로 시작</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>기존 세션 폐기 · 7개 파일 모두 다시 분석</div>
                </div>
              </button>

              <button style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px', borderRadius: 8,
                background: 'transparent', border: '1px solid var(--border)',
                color: 'var(--text-secondary)', cursor: 'pointer', textAlign: 'left',
              }}>
                <Icon name="square" size={14} color="var(--critical)" fill="var(--critical)" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>중단하고 결과만 보기</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>현재까지 분석된 5건의 취약점을 확인</div>
                </div>
              </button>
            </div>
          </div>

          <div style={{
            padding: '10px 24px',
            background: 'var(--bg-2)',
            borderTop: '1px solid var(--hairline)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
              <Icon name="alert" size={10} style={{ marginRight: 4, verticalAlign: '-1px' }} />
              세션은 30분 후 자동 만료됩니다
            </span>
            <button className="btn btn-sm btn-ghost" style={{ color: 'var(--text-tertiary)' }}>나중에 결정</button>
          </div>
        </div>
      </div>
    </WindowChrome>
  );
}

// ─── Cmd+K palette — MULTI-SELECT variant ───────────────────
// Demonstrates the multi-select UX: Cmd/Ctrl-click to toggle, Shift-click
// for range, hover-revealed checkboxes, and a bulk action bar that slides
// in from the bottom of the palette when any item is selected.
function CmdKPaletteMultiSelect({ width = 1100, height = 720 }) {
  const items = [
    { id:'v1', tag:'CRITICAL', tone:'critical', title:'SQL Injection', sub:'api/users/route.ts:42 · CWE-89', meta:'EXPLOITED', selected: true },
    { id:'v2', tag:'CRITICAL', tone:'critical', title:'Hardcoded Secret', sub:'lib/config.ts:18 · CWE-798', selected: true },
    { id:'v3', tag:'HIGH', tone:'high', title:'XSS — Stored', sub:'components/comment.tsx:73 · CWE-79', selected: true },
    { id:'v5', tag:'HIGH', tone:'high', title:'Path Traversal', sub:'api/files/[name].ts:24 · CWE-22' },
    { id:'v6', tag:'MEDIUM', tone:'medium', title:'Open Redirect', sub:'middleware.ts:55 · CWE-601' },
    { id:'v7', tag:'MEDIUM', tone:'medium', title:'Weak Crypto (MD5)', sub:'utils/hash.ts:9 · CWE-327' },
  ];

  return (
    <WindowChrome width={width} height={height} title="Pagori · Cmd+K · 다중 선택">
      <div style={{
        flex: 1, position: 'relative', background: 'var(--bg-0)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: 72,
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }} />

        <div style={{
          position: 'relative', width: 680, zIndex: 2,
          background: 'var(--bg-1)',
          border: '1px solid var(--border-2)',
          borderRadius: 12,
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          overflow: 'hidden',
        }}>
          {/* Search input */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '14px 20px', borderBottom: '1px solid var(--hairline)',
          }}>
            <Icon name="search" size={16} color="var(--text-tertiary)" />
            <input
              defaultValue=""
              placeholder="취약점·파일·CVE 검색…"
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 14, color: 'var(--text-primary)' }}
            />
            <span className="mono" style={{ padding: '3px 6px', borderRadius: 4, background: 'var(--bg-3)', border: '1px solid var(--border)', fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)' }}>ESC</span>
          </div>

          {/* Scope chips + select-all */}
          <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--hairline)' }}>
            {/* Select-all checkbox */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11, color: 'var(--text-tertiary)' }}>
              <span style={{
                width: 14, height: 14, borderRadius: 3,
                border: '1.5px solid var(--border-3)',
                background: 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {/* Indeterminate state */}
                <span style={{ width: 8, height: 2, background: 'var(--orange-2)' }} />
              </span>
              <span>3/6</span>
            </label>
            <div style={{ width: 1, height: 14, background: 'var(--hairline)' }} />
            <Chip tone="critical" active>취약점 6</Chip>
            <Chip>파일 0</Chip>
            <Chip>액션 0</Chip>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="mono" style={{ padding: '1px 4px', borderRadius: 3, background: 'var(--bg-3)', border: '1px solid var(--border)' }}>⌘ Click</span>
              토글 ·
              <span className="mono" style={{ padding: '1px 4px', borderRadius: 3, background: 'var(--bg-3)', border: '1px solid var(--border)' }}>⇧ Click</span>
              범위
            </span>
          </div>

          {/* Group header */}
          <div style={{
            padding: '8px 16px', fontSize: 9, fontWeight: 700,
            color: 'var(--text-tertiary)', letterSpacing: '0.08em',
            fontFamily: 'var(--font-mono)', background: 'var(--bg-2)',
          }}>취약점</div>

          {/* Multi-select rows */}
          <div style={{ maxHeight: 340, overflow: 'auto' }}>
            {items.map((item, i) => {
              const isFocused = i === 3; // keyboard focus, not selection
              return (
                <div key={item.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 16px',
                  background: item.selected ? 'var(--orange-dim)' : (isFocused ? 'var(--surface-hover)' : 'transparent'),
                  borderLeft: item.selected ? '2px solid var(--orange-2)' : isFocused ? '2px solid var(--border-3)' : '2px solid transparent',
                  cursor: 'pointer',
                }}>
                  {/* Checkbox */}
                  <span style={{
                    width: 16, height: 16, borderRadius: 3,
                    border: `1.5px solid ${item.selected ? 'var(--orange-2)' : 'var(--border-3)'}`,
                    background: item.selected ? 'var(--orange-2)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                    opacity: (item.selected || isFocused) ? 1 : 0.4,
                  }}>
                    {item.selected && <Icon name="check" size={10} color="#fff" stroke={3} />}
                  </span>

                  <span className={`chip chip-${item.tone}`} style={{ width: 70, justifyContent: 'center', flexShrink: 0 }}>
                    <span className="severity-dot" style={{ background: SEV_META[item.tone].color }} />
                    {item.tag}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{item.title}</div>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{item.sub}</div>
                  </div>
                  {item.meta && <span className="chip chip-critical">{item.meta}</span>}
                </div>
              );
            })}
          </div>

          {/* Bulk action bar — appears when items selected */}
          <div style={{
            padding: '10px 16px',
            background: 'var(--bg-2)',
            borderTop: '1px solid var(--orange)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <div style={{
              width: 26, height: 26, borderRadius: 6,
              background: 'var(--orange-2)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)',
            }}>3</div>
            <span style={{ fontSize: 12, fontWeight: 600 }}>개 취약점 선택됨</span>
            <div style={{ flex: 1 }} />
            <button className="btn btn-sm"><Icon name="zap" size={11} />패치 일괄</button>
            <button className="btn btn-sm"><Icon name="terminal" size={11} />DAST 실행</button>
            <button className="btn btn-sm"><Icon name="sparkle" size={11} />AI에게 질문</button>
            <button className="btn btn-sm btn-ghost" style={{ color: 'var(--text-tertiary)' }}><Icon name="download" size={11} />내보내기</button>
            <button title="해제" className="btn btn-sm btn-ghost" style={{ width: 24, padding: 0, justifyContent: 'center' }}><Icon name="x" size={11} /></button>
          </div>
        </div>
      </div>
    </WindowChrome>
  );
}

Object.assign(window, { EmptyStatesCollection, CmdKPalette, CmdKPaletteMultiSelect, NotificationCenter, ResumeModal });
