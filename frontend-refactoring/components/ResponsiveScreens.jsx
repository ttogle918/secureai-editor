/* global React, Icon, Chip, WindowChrome, SEV_META, MOCK_VULNS, MOCK_NOTIFICATIONS, PagoriLockup, PagoriMark, IOSDevice, IOSStatusBar */
// ResponsiveScreens.jsx — Mobile (iOS frame) + Tablet views.
//
// Mobile (<768px): single-column, bottom tab nav, no editor.
// Tablet (768-1280px): 2-panel — sidebar collapsed slim rail + code + right panel.

// ──────────────────────────────────────────────────────────
// MOBILE PRIMITIVES
// ──────────────────────────────────────────────────────────

function MobileHeader({ title, subtitle, leading, trailing }) {
  return (
    <div style={{
      paddingTop: 56, paddingBottom: 12, paddingLeft: 18, paddingRight: 18,
      background: 'var(--bg-0)',
      display: 'flex', alignItems: 'center', gap: 12,
      borderBottom: '1px solid var(--hairline)',
    }}>
      {leading || <PagoriMark size={26} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{subtitle}</div>}
      </div>
      {trailing}
    </div>
  );
}

function MobileTabBar({ active = 'vulns' }) {
  const tabs = [
    { id: 'home', icon: 'layout', label: '홈' },
    { id: 'vulns', icon: 'shieldAlert', label: '취약점', badge: 10 },
    { id: 'chat', icon: 'sparkle', label: 'AI' },
    { id: 'notif', icon: 'bell', label: '알림', badge: 2 },
    { id: 'me', icon: 'user', label: '내 정보' },
  ];
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 30,
      paddingBottom: 22, paddingTop: 8,
      background: 'rgba(8,8,9,0.85)',
      backdropFilter: 'blur(20px) saturate(180%)',
      WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      borderTop: '1px solid var(--hairline)',
      display: 'flex',
    }}>
      {tabs.map(t => {
        const isActive = active === t.id;
        return (
          <button key={t.id} style={{
            flex: 1, position: 'relative',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            border: 'none', background: 'transparent', cursor: 'pointer',
            color: isActive ? 'var(--orange)' : 'var(--text-tertiary)',
          }}>
            <span style={{ position: 'relative' }}>
              <Icon name={t.icon} size={20} stroke={isActive ? 2 : 1.6} />
              {t.badge && (
                <span style={{
                  position: 'absolute', top: -3, right: -8,
                  minWidth: 14, height: 14, borderRadius: 7,
                  background: 'var(--critical)', color: '#fff',
                  fontSize: 8, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 3px', border: '1.5px solid var(--bg-0)',
                }}>{t.badge}</span>
              )}
            </span>
            <span style={{ fontSize: 10, fontWeight: 600 }}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// Wraps mobile content inside IOSDevice frame with our dark Pagori app
function PhoneScreen({ children, tab = 'vulns' }) {
  return (
    <IOSDevice dark={true} width={390} height={844}>
      <div style={{
        background: 'var(--bg-0)',
        height: '100%',
        display: 'flex', flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {children}
        <MobileTabBar active={tab} />
      </div>
    </IOSDevice>
  );
}

// ──────────────────────────────────────────────────────────
// MOBILE 1 — HOME (project list)
// ──────────────────────────────────────────────────────────
function MobileHome() {
  const projects = [
    { name: 'shop-api', sub: '서버/API · main · 2분 전', score: 62, vulns: 10, critical: 2, color: 'var(--orange)' },
    { name: 'shop-admin', sub: '웹 · main · 어제', score: 84, vulns: 3, critical: 0, color: 'var(--low)' },
    { name: 'shop-mobile', sub: '모바일 · develop · 3일 전', score: 71, vulns: 5, critical: 0, color: 'var(--high)' },
  ];

  return (
    <PhoneScreen tab="home">
      <MobileHeader
        leading={<PagoriLockup size={22} />}
        title=""
        trailing={
          <button style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'var(--bg-2)', border: '1px solid var(--border)',
            color: 'var(--text-primary)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><Icon name="search" size={16} /></button>
        }
      />

      <div style={{ padding: '16px 18px 100px', flex: 1, overflow: 'auto' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 8 }}>안녕하세요, 지민 👋</h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 20 }}>
          오늘 <strong style={{ color: 'var(--critical)' }}>2건의 CRITICAL</strong>을 확인해야 해요.
        </p>

        {/* Quick stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>활성 취약점</div>
            <div className="mono" style={{ fontSize: 24, fontWeight: 700, color: 'var(--critical)', marginTop: 4 }}>18</div>
            <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 2 }}>3개 프로젝트</div>
          </div>
          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>평균 보안 점수</div>
            <div className="mono" style={{ fontSize: 24, fontWeight: 700, color: 'var(--orange)', marginTop: 4 }}>72</div>
            <div style={{ fontSize: 9, color: 'var(--low)', marginTop: 2 }}>↑ +5 vs 지난주</div>
          </div>
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em', marginBottom: 10, fontFamily: 'var(--font-mono)' }}>
          내 프로젝트
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {projects.map(p => (
            <div key={p.name} style={{
              padding: 14, borderRadius: 12,
              background: 'var(--bg-1)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: 10,
                background: 'linear-gradient(135deg, rgba(249,115,22,0.20), rgba(249,115,22,0.10))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700,
                color: p.color,
                border: `1px solid ${p.color === 'var(--low)' ? 'rgba(34,197,94,0.30)' : 'rgba(249,115,22,0.30)'}`,
              }}>{p.score}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="mono" style={{ fontSize: 14, fontWeight: 700 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{p.sub}</div>
                <div style={{ display: 'flex', gap: 5, marginTop: 6 }}>
                  {p.critical > 0 && <span className="chip chip-critical" style={{ height: 17, fontSize: 8 }}>CRITICAL {p.critical}</span>}
                  <span className="chip" style={{ height: 17, fontSize: 8 }}>총 {p.vulns}건</span>
                </div>
              </div>
              <Icon name="chevronRight" size={14} color="var(--text-tertiary)" />
            </div>
          ))}
        </div>

        <button style={{
          width: '100%', marginTop: 14, padding: 14, borderRadius: 12,
          background: 'transparent', border: '1.5px dashed var(--border-2)',
          color: 'var(--text-secondary)', cursor: 'pointer',
          fontSize: 13, fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <Icon name="plus" size={13} />새 프로젝트
        </button>
      </div>
    </PhoneScreen>
  );
}

// ──────────────────────────────────────────────────────────
// MOBILE 2 — VULNERABILITY LIST (filterable)
// ──────────────────────────────────────────────────────────
function MobileVulnList() {
  return (
    <PhoneScreen tab="vulns">
      <MobileHeader
        leading={
          <button style={{ width: 32, height: 32, borderRadius: 8, background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="chevronLeft" size={16} />
          </button>
        }
        title="shop-api"
        subtitle="main · 10건 취약점"
        trailing={
          <button style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'var(--bg-2)', border: '1px solid var(--border)',
            color: 'var(--text-primary)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><Icon name="filter" size={15} /></button>
        }
      />

      {/* Sticky filter chips */}
      <div style={{
        padding: '10px 18px',
        background: 'var(--bg-0)',
        borderBottom: '1px solid var(--hairline)',
        display: 'flex', gap: 6, overflow: 'auto', flexWrap: 'nowrap',
      }}>
        <Chip tone="critical" active>CRITICAL 2</Chip>
        <Chip tone="high" active>HIGH 3</Chip>
        <Chip tone="medium">MED 3</Chip>
        <Chip tone="low">LOW 2</Chip>
        <span style={{ width: 1, alignSelf: 'stretch', background: 'var(--hairline)', flexShrink: 0 }} />
        <Chip tone="critical">EXPLOITED 1</Chip>
        <Chip>미실행 7</Chip>
      </div>

      {/* Vuln list */}
      <div style={{ flex: 1, overflow: 'auto', paddingBottom: 100 }}>
        {MOCK_VULNS.slice(0, 8).map((v, i) => (
          <div key={v.id} style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--hairline)',
            borderLeft: i === 0 ? `3px solid ${SEV_META[v.severity].color}` : '3px solid transparent',
            background: i === 0 ? 'var(--surface-overlay)' : 'transparent',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span className="severity-dot" style={{ background: SEV_META[v.severity].color, boxShadow: v.severity === 'critical' ? `0 0 6px ${SEV_META[v.severity].color}` : 'none' }} />
              <span style={{ fontSize: 14, fontWeight: 700, flex: 1 }}>{v.type}</span>
              {v.tags.includes('DAST_EXPLOITED') && <span className="chip chip-critical" style={{ height: 17, fontSize: 8 }}>EXPLOITED</span>}
            </div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {v.file}:{v.line}
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <span className="chip" style={{ height: 17, fontSize: 8 }}>{v.cwe}</span>
              {v.tags.slice(0, 2).map(t => <span key={t} className="chip" style={{ height: 17, fontSize: 8 }}>{t}</span>)}
            </div>
          </div>
        ))}
      </div>
    </PhoneScreen>
  );
}

// ──────────────────────────────────────────────────────────
// MOBILE 3 — VULNERABILITY DETAIL
// ──────────────────────────────────────────────────────────
function MobileVulnDetail() {
  const v = MOCK_VULNS[0];
  return (
    <PhoneScreen tab="vulns">
      <MobileHeader
        leading={
          <button style={{ width: 32, height: 32, borderRadius: 8, background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="chevronLeft" size={16} />
          </button>
        }
        title="취약점 상세"
        trailing={
          <button style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="sparkle" size={16} />
          </button>
        }
      />

      <div style={{ flex: 1, overflow: 'auto', padding: '16px 18px 100px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span className="chip chip-critical">
            <span className="severity-dot" style={{ background: 'var(--critical)' }} />CRITICAL
          </span>
          <span className="chip chip-critical">EXPLOITED</span>
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 8 }}>{v.type}</h1>
        <div className="mono" style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 14 }}>{v.file}:{v.line}</div>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>{v.desc}</p>

        {/* Code snippet */}
        <div style={{
          padding: 14, background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 10,
          fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.6, marginBottom: 16, overflow: 'auto',
        }}>
          <div style={{ color: 'var(--text-tertiary)' }}>40 const userId = searchParams.get('id');</div>
          <div style={{ background: 'var(--critical-dim)', margin: '0 -14px', padding: '0 14px', color: 'var(--text-primary)' }}>
            42 const query = `SELECT * FROM users WHERE id = <span style={{ background: 'rgba(240,65,65,0.25)', borderBottom: '2px wavy var(--critical)' }}>${'${userId}'}</span>`
          </div>
          <div style={{ color: 'var(--text-tertiary)' }}>43 const rows = await db.query(query);</div>
        </div>

        {/* Tags */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
          <span className="chip">{v.cwe}</span>
          <span className="chip">{v.owasp}</span>
          {v.tags.map(t => <span key={t} className="chip" style={{ color: 'var(--tag-1)', borderColor: 'rgba(129,140,248,0.4)' }}>{t}</span>)}
        </div>

        {/* AI patch card */}
        <div style={{
          padding: 14, borderRadius: 10,
          background: 'rgba(34,197,94,0.06)',
          border: '1px solid rgba(34,197,94,0.30)',
          marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <Icon name="sparkle" size={13} color="var(--low)" />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--low)' }}>AI 패치 제안</span>
          </div>
          <div style={{ padding: 10, background: 'var(--bg-0)', borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: 10, lineHeight: 1.6, marginBottom: 10 }}>
            <div style={{ color: 'var(--critical)' }}>- query = `... id = ${'${userId}'}`</div>
            <div style={{ color: 'var(--low)' }}>+ query = '... id = $1'</div>
            <div style={{ color: 'var(--low)' }}>+ await db.query(query, [userId])</div>
          </div>
          <button className="btn btn-primary" style={{ width: '100%' }}>
            <Icon name="check" size={11} stroke={2.4} />적용
          </button>
        </div>

        {/* Action row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button className="btn"><Icon name="terminal" size={11} />DAST 실행</button>
          <button className="btn"><Icon name="sparkle" size={11} />AI 질문</button>
        </div>
      </div>
    </PhoneScreen>
  );
}

// ──────────────────────────────────────────────────────────
// MOBILE 4 — AI CHAT BUBBLE (3 states)
// User wants: floating circular button bottom-right (like editor),
// click → speech-bubble popup, resizable bubble (font scales with size),
// AI patch suggestion card matches editor exactly.
// ──────────────────────────────────────────────────────────

// Backdrop = the vulnerability list screen (so user sees the bubble layered over real content)
function MobileVulnListBackdrop() {
  return (
    <>
      <MobileHeader
        leading={
          <button style={{ width: 32, height: 32, borderRadius: 8, background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="chevronLeft" size={16} />
          </button>
        }
        title="shop-api"
        subtitle="main · 10건 취약점"
        trailing={null}
      />
      <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--hairline)', display: 'flex', gap: 6, overflow: 'auto', flexWrap: 'nowrap' }}>
        <Chip tone="critical" active>CRITICAL 2</Chip>
        <Chip tone="high" active>HIGH 3</Chip>
        <Chip tone="medium">MED 3</Chip>
        <Chip tone="low">LOW 2</Chip>
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {MOCK_VULNS.slice(0, 5).map((v, i) => (
          <div key={v.id} style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--hairline)',
            borderLeft: i === 0 ? `3px solid ${SEV_META[v.severity].color}` : '3px solid transparent',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span className="severity-dot" style={{ background: SEV_META[v.severity].color }} />
              <span style={{ fontSize: 14, fontWeight: 700, flex: 1 }}>{v.type}</span>
            </div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{v.file}:{v.line}</div>
          </div>
        ))}
      </div>
    </>
  );
}

// ─── Floating circular bubble (closed state) ─────────────
function ChatFAB({ unread = 1, hint }) {
  return (
    <div style={{
      position: 'absolute', bottom: 96, right: 18, zIndex: 25,
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      {hint && (
        <div style={{
          padding: '8px 12px', borderRadius: 10,
          background: 'var(--bg-1)', border: '1px solid var(--border-2)',
          boxShadow: '0 6px 18px rgba(0,0,0,0.4)',
          fontSize: 11, color: 'var(--text-on-bg)',
          maxWidth: 180,
        }}>{hint}</div>
      )}
      <button style={{
        position: 'relative',
        width: 56, height: 56, borderRadius: 28,
        background: 'linear-gradient(135deg, var(--orange) 0%, var(--orange-2) 100%)',
        border: 'none', color: '#fff',
        boxShadow: '0 8px 24px rgba(234,88,12,0.55), 0 0 0 1px rgba(255,255,255,0.10) inset',
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name="sparkle" size={24} color="#fff" stroke={2} />
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: -2, right: -2,
            minWidth: 20, height: 20, borderRadius: 10,
            background: 'var(--critical)', color: '#fff',
            fontSize: 11, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid var(--bg-0)',
          }}>{unread}</span>
        )}
      </button>
    </div>
  );
}

// ─── Speech-bubble popup with resize-handle ──────────────
// Font scales with bubble width so resize feels live.
function ChatSpeechBubble({ size = 'M' }) {
  // Three sizes — S/M/L; M is the default. Font scales accordingly.
  const sizeMap = {
    S: { w: 280, h: 340, fs: 11, msgFs: 11.5, codeFs: 9.5, bottom: 96, right: 18 },
    M: { w: 332, h: 440, fs: 13, msgFs: 13, codeFs: 10.5, bottom: 96, right: 18 },
    L: { w: 362, h: 620, fs: 15, msgFs: 15, codeFs: 11.5, bottom: 96, right: 14 },
  };
  const s = sizeMap[size];

  return (
    <div style={{
      position: 'absolute',
      bottom: s.bottom, right: s.right, zIndex: 25,
      width: s.w, maxHeight: s.h,
      background: 'var(--bg-1)',
      border: '1px solid var(--border-2)',
      borderRadius: 18,
      boxShadow: '0 16px 48px rgba(0,0,0,0.55)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      animation: 'fadein .2s',
    }}>
      {/* Speech-bubble tail pointing to FAB */}
      <span style={{
        position: 'absolute', bottom: -8, right: 22,
        width: 16, height: 16, background: 'var(--bg-1)',
        border: '1px solid var(--border-2)', borderTop: 'none', borderLeft: 'none',
        transform: 'rotate(45deg)',
        zIndex: -1,
      }} />

      {/* Header with resize hint */}
      <div style={{
        padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8,
        borderBottom: '1px solid var(--hairline)', background: 'var(--bg-2)',
      }}>
        <div style={{ width: 22, height: 22, borderRadius: 5, background: 'var(--orange-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="sparkle" size={11} color="var(--orange)" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: s.fs, fontWeight: 700, color: 'var(--text-active)' }}>Pagori 보안 에이전트</div>
          <div className="mono" style={{ fontSize: s.fs - 2, color: 'var(--text-tertiary)' }}>v1 SQL Injection</div>
        </div>
        <button title="닫기" style={{ width: 22, height: 22, borderRadius: 5, border: 'none', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="x" size={12} />
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflow: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* User msg */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{
            padding: '7px 11px', borderRadius: 14,
            background: 'var(--orange-2)', color: '#fff',
            maxWidth: '85%', fontSize: s.msgFs, lineHeight: 1.45,
          }}>
            이 취약점 어떻게 패치해?
          </div>
        </div>

        {/* AI msg with patch card (matches editor exactly) */}
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ width: 20, height: 20, borderRadius: 5, background: 'var(--orange-dim)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="sparkle" size={10} color="var(--orange)" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: s.msgFs, lineHeight: 1.5, marginBottom: 8, color: 'var(--text-on-bg)' }}>
              parameterized query로 바꾸시면 안전해요. 패치 만들어드렸어요.
            </div>

            {/* AI PATCH SUGGESTION — matches editor style exactly */}
            <div style={{
              border: '1px solid rgba(34,197,94,0.30)',
              borderRadius: 8, overflow: 'hidden',
              background: 'rgba(34,197,94,0.04)',
            }}>
              <div style={{
                padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6,
                borderBottom: '1px solid rgba(34,197,94,0.20)',
              }}>
                <Icon name="sparkle" size={10} color="var(--low)" />
                <span style={{ fontSize: s.fs - 2, fontWeight: 700, color: 'var(--low)' }}>AI 패치 제안</span>
                <div style={{ flex: 1 }} />
                <button style={{ height: 20, padding: '0 8px', borderRadius: 4, background: 'var(--low)', color: '#0a2810', border: 'none', fontWeight: 700, fontSize: s.fs - 2, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  <Icon name="check" size={9} stroke={2.6} />적용
                </button>
              </div>
              <div style={{ padding: 8, fontFamily: 'var(--font-mono)', fontSize: s.codeFs, lineHeight: 1.55, background: 'var(--bg-0)' }}>
                <div style={{ color: 'var(--critical)' }}>- query = `... id = ${'${userId}'}`</div>
                <div style={{ color: 'var(--low)' }}>+ query = '... id = $1'</div>
                <div style={{ color: 'var(--low)' }}>+ await db.query(query, [userId])</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Input */}
      <div style={{ padding: '8px 10px', borderTop: '1px solid var(--hairline)', background: 'var(--bg-2)' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 10px', borderRadius: 14,
          background: 'var(--bg-3)', border: '1px solid var(--border)',
        }}>
          <span style={{ flex: 1, fontSize: s.fs, color: 'var(--text-tertiary)' }}>@취약점 · 메시지…</span>
          <button style={{ width: 22, height: 22, borderRadius: 11, background: 'var(--orange-2)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Icon name="arrowRight" size={11} stroke={2.4} />
          </button>
        </div>
      </div>

      {/* Resize handle — bottom-left corner */}
      <div title="드래그해서 크기 조절 · 글자도 함께 커집니다" style={{
        position: 'absolute', bottom: 0, left: 0,
        width: 18, height: 18, cursor: 'nwse-resize',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-start',
        padding: 4,
      }}>
        <svg width="10" height="10" viewBox="0 0 10 10">
          <path d="M0 10 L10 0 M0 6 L6 0 M0 2 L2 0" stroke="var(--text-tertiary)" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </div>

      {/* Size indicator (only visible while resizing — we show always for demo) */}
      <div style={{
        position: 'absolute', top: -28, left: '50%', transform: 'translateX(-50%)',
        padding: '3px 8px', borderRadius: 4,
        background: 'var(--orange-2)', color: '#fff',
        fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)',
        whiteSpace: 'nowrap',
      }}>{size} · {s.w}×{s.h} · {s.fs}px</div>
    </div>
  );
}

// Variant: bubble closed (just FAB visible over the vuln list)
function MobileChatClosed() {
  return (
    <PhoneScreen tab="vulns">
      <MobileVulnListBackdrop />
      <ChatFAB unread={1} hint="한 번 클릭으로 채팅을 시작하세요" />
    </PhoneScreen>
  );
}

// Variant: medium bubble (default open)
function MobileChatBubbleM() {
  return (
    <PhoneScreen tab="vulns">
      <MobileVulnListBackdrop />
      <ChatSpeechBubble size="M" />
    </PhoneScreen>
  );
}

// Variant: large bubble (resized — font scales up)
function MobileChatBubbleL() {
  return (
    <PhoneScreen tab="vulns">
      <MobileVulnListBackdrop />
      <ChatSpeechBubble size="L" />
    </PhoneScreen>
  );
}

// Backward-compat alias — kept so MobileCollection still works
const MobileChat = MobileChatBubbleM;

// ──────────────────────────────────────────────────────────
// MOBILE 5 — DASHBOARD (compact)
// ──────────────────────────────────────────────────────────
function MobileDashboard() {
  return (
    <PhoneScreen tab="home">
      <MobileHeader
        leading={
          <button style={{ width: 32, height: 32, borderRadius: 8, background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="chevronLeft" size={16} />
          </button>
        }
        title="대시보드"
        subtitle="shop-api · 7일"
        trailing={
          <button style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="download" size={15} />
          </button>
        }
      />

      <div style={{ flex: 1, overflow: 'auto', padding: '16px 18px 100px' }}>
        {/* Score hero */}
        <div style={{
          padding: 20, borderRadius: 16,
          background: 'linear-gradient(135deg, rgba(249,115,22,0.18), rgba(249,115,22,0.05))',
          border: '1px solid rgba(249,115,22,0.30)',
          textAlign: 'center', marginBottom: 16,
        }}>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' }}>보안 점수</div>
          <div className="mono" style={{ fontSize: 64, fontWeight: 700, color: 'var(--orange)', lineHeight: 1, margin: '8px 0' }}>62</div>
          <div style={{ fontSize: 11, color: 'var(--low)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <Icon name="trend" size={11} />+7 vs 어제
          </div>
        </div>

        {/* Severity counts */}
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em', marginBottom: 8, fontFamily: 'var(--font-mono)' }}>심각도</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
          {[
            { sev: 'critical', label: 'CRITICAL', count: 2 },
            { sev: 'high', label: 'HIGH', count: 3 },
            { sev: 'medium', label: 'MEDIUM', count: 3 },
            { sev: 'low', label: 'LOW', count: 2 },
          ].map(r => (
            <div key={r.sev} className="card" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="severity-dot" style={{ background: SEV_META[r.sev].color, boxShadow: r.sev === 'critical' ? `0 0 6px ${SEV_META[r.sev].color}` : 'none' }} />
              <span style={{ flex: 1, fontSize: 10, fontWeight: 700, color: SEV_META[r.sev].color, fontFamily: 'var(--font-mono)' }}>{r.label}</span>
              <span className="mono" style={{ fontSize: 18, fontWeight: 700 }}>{r.count}</span>
            </div>
          ))}
        </div>

        {/* Trend mini */}
        <div className="card" style={{ padding: 14, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700 }}>점수 트렌드</div>
            <div style={{ flex: 1 }} />
            <span className="chip chip-low" style={{ height: 18 }}>+21</span>
          </div>
          <svg viewBox="0 0 320 70" style={{ width: '100%', height: 70 }}>
            <defs>
              <linearGradient id="m-trend-g" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--orange)" stopOpacity="0.30" />
                <stop offset="100%" stopColor="var(--orange)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M0,46 L46,40 L92,36 L138,28 L184,20 L230,16 L276,24 L320,8 L320,70 L0,70 Z" fill="url(#m-trend-g)" />
            <path d="M0,46 L46,40 L92,36 L138,28 L184,20 L230,16 L276,24 L320,8" fill="none" stroke="var(--orange)" strokeWidth="2" />
          </svg>
        </div>

        {/* Top 3 priorities */}
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em', marginBottom: 8, fontFamily: 'var(--font-mono)' }}>우선순위</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {MOCK_VULNS.slice(0, 3).map((v, i) => (
            <div key={v.id} className="card" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                width: 24, height: 24, borderRadius: 5,
                background: SEV_META[v.severity].dim, color: SEV_META[v.severity].color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)',
              }}>{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{v.type}</div>
                <div className="mono" style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.file}:{v.line}</div>
              </div>
              <Icon name="chevronRight" size={12} color="var(--text-tertiary)" />
            </div>
          ))}
        </div>
      </div>
    </PhoneScreen>
  );
}

// ──────────────────────────────────────────────────────────
// MOBILE 6 — NOTIFICATIONS
// ──────────────────────────────────────────────────────────
function MobileNotifications() {
  return (
    <PhoneScreen tab="notif">
      <MobileHeader
        leading={
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--orange-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--orange)' }}>
            <Icon name="bell" size={16} />
          </div>
        }
        title="알림"
        subtitle="2개의 새 알림"
        trailing={
          <button className="btn btn-sm btn-ghost" style={{ color: 'var(--text-tertiary)' }}>모두 읽음</button>
        }
      />

      {/* Tabs */}
      <div style={{ display: 'flex', padding: '0 18px', gap: 6, borderBottom: '1px solid var(--hairline)' }}>
        {[
          { label: '전체', count: 4, active: true },
          { label: '분석', count: 1 },
          { label: 'CVE', count: 1 },
          { label: 'PR', count: 1 },
        ].map((t, i) => (
          <button key={i} style={{
            padding: '12px 4px', border: 'none', background: 'transparent',
            borderBottom: t.active ? '2px solid var(--orange-2)' : '2px solid transparent',
            color: t.active ? 'var(--text-primary)' : 'var(--text-tertiary)',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>{t.label} <span style={{ fontSize: 10, opacity: 0.7 }}>{t.count}</span></button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', paddingBottom: 100 }}>
        {MOCK_NOTIFICATIONS.map((n, i) => {
          const iconMap = { analysis_done: 'check', cve: 'alert', pr: 'github', sla: 'history' };
          const colorMap = { analysis_done: 'var(--low)', cve: 'var(--critical)', pr: 'var(--tag-1)', sla: 'var(--high)' };
          return (
            <div key={n.id} style={{
              padding: '14px 18px',
              borderBottom: i < MOCK_NOTIFICATIONS.length - 1 ? '1px solid var(--hairline)' : 'none',
              background: n.unread ? 'var(--surface-overlay)' : 'transparent',
              display: 'flex', gap: 12, position: 'relative',
            }}>
              {n.unread && (
                <span style={{ position: 'absolute', top: 18, left: 6, width: 6, height: 6, borderRadius: '50%', background: 'var(--orange-2)' }} />
              )}
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: `${colorMap[n.type]}1A`, color: colorMap[n.type],
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}><Icon name={iconMap[n.type]} size={16} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 3 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{n.title}</span>
                  <div style={{ flex: 1 }} />
                  <span className="mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{n.time}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{n.body}</div>
              </div>
            </div>
          );
        })}
      </div>
    </PhoneScreen>
  );
}

// ──────────────────────────────────────────────────────────
// MOBILE COLLECTION ARTBOARD
// ──────────────────────────────────────────────────────────
function MobileCollection({ width = 1500, height = 950 }) {
  return (
    <div style={{
      width, minHeight: height,
      display: 'flex', flexWrap: 'wrap',
      alignItems: 'flex-start', justifyContent: 'center', gap: 28,
      padding: '24px 24px 24px',
      background: '#1a1815',
      overflow: 'auto', borderRadius: 12,
    }}>
      {[
        { c: <MobileHome />, label: '홈' },
        { c: <MobileVulnList />, label: '취약점 목록' },
        { c: <MobileVulnDetail />, label: '취약점 상세' },
        { c: <MobileChatClosed />, label: 'AI 채팅 · 플로팅 버튼' },
        { c: <MobileChatBubbleM />, label: 'AI 채팅 · 말풍선 (M)' },
        { c: <MobileChatBubbleL />, label: 'AI 채팅 · 크기 조절 (L)' },
        { c: <MobileDashboard />, label: '대시보드' },
        { c: <MobileNotifications />, label: '알림' },
      ].map((s, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          {s.c}
          <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.8)', fontFamily: 'var(--font-sans)' }}>{s.label}</div>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// TABLET — Editor in 2-panel mode (768-1280px)
// ══════════════════════════════════════════════════════════════════
function TabletEditor({ width = 1024, height = 768 }) {
  // Tablet: slim sidebar + code (or vuln list) + AI chat / vuln drawer
  return (
    <WindowChrome width={width} height={height} title="Pagori · iPad / Tablet — 1024 × 768">
      {/* Header */}
      <div style={{
        height: 44, flexShrink: 0, background: 'var(--bg-1)',
        borderBottom: '1px solid var(--hairline)',
        display: 'flex', alignItems: 'center', padding: '0 14px', gap: 10,
      }}>
        <PagoriLockup size={20} />
        <div style={{ width: 1, height: 16, background: 'var(--hairline)' }} />
        <span className="mono" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>shop-api · main · route.ts</span>
        <div style={{ flex: 1 }} />
        <span className="chip chip-critical" style={{ height: 20 }}>10 취약점</span>
        <button className="btn btn-sm"><Icon name="search" size={11} /></button>
        <button style={{ position: 'relative', width: 26, height: 26, borderRadius: 5, border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="bell" size={12} />
          <span style={{ position: 'absolute', top: -3, right: -3, minWidth: 12, height: 12, borderRadius: 6, background: 'var(--orange-2)', color: '#fff', fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 2px var(--bg-1)' }}>2</span>
        </button>
        <button className="btn btn-sm btn-primary"><Icon name="play" size={11} fill="currentColor" />분석</button>
      </div>

      {/* 2-panel layout — sidebar collapsed, code + right panel */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Slim rail */}
        <div style={{
          width: 48, flexShrink: 0, background: 'var(--bg-1)',
          borderRight: '1px solid var(--hairline)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '10px 0', gap: 4,
        }}>
          {['folder','shieldAlert','package','sparkle','history','settings'].map((ic, i) => (
            <button key={i} style={{
              width: 32, height: 32, borderRadius: 7,
              background: i === 1 ? 'var(--orange-dim)' : 'transparent',
              color: i === 1 ? 'var(--orange)' : 'var(--text-tertiary)',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative',
            }}>
              <Icon name={ic} size={14} />
              {i === 1 && <span style={{ position: 'absolute', top: 2, right: 2, minWidth: 11, height: 11, borderRadius: 6, background: 'var(--critical)', color: '#fff', fontSize: 7, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 2px' }}>10</span>}
            </button>
          ))}
        </div>

        {/* Code (compact) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ height: 30, flexShrink: 0, background: 'var(--bg-1)', borderBottom: '1px solid var(--hairline)', display: 'flex' }}>
            {[
              { name: 'route.ts', active: true, vuln: 'critical' },
              { name: 'comment.tsx', vuln: 'high' },
            ].map(t => (
              <div key={t.name} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px',
                background: t.active ? 'var(--bg-0)' : 'transparent',
                borderRight: '1px solid var(--hairline)',
                borderTop: t.active ? '1.5px solid var(--orange-2)' : '1.5px solid transparent',
                fontSize: 11, fontFamily: 'var(--font-mono)',
                color: t.active ? 'var(--text-primary)' : 'var(--text-secondary)',
              }}>
                <span className="severity-dot" style={{ background: SEV_META[t.vuln].color }} />
                {t.name}
              </div>
            ))}
          </div>
          <div style={{
            flex: 1, minHeight: 0, overflow: 'auto', background: 'var(--bg-0)',
            fontFamily: 'var(--font-mono)', fontSize: 11.5, lineHeight: '18px', padding: '10px 0',
          }}>
            {[
              { n: 38, code: 'export async function GET(req: Request) {' },
              { n: 39, code: '  const { searchParams } = new URL(req.url);' },
              { n: 40, code: '  const userId = searchParams.get(\'id\');' },
              { n: 41, code: '  // 🔴 Critical: SQL injection', vuln: 'critical' },
              { n: 42, code: '  const query = `SELECT * FROM users WHERE id = ${userId}`;', vuln: 'critical' },
              { n: 43, code: '  const rows = await db.query(query);' },
              { n: 44, code: '  return Response.json(rows);' },
              { n: 45, code: '}' },
            ].map((l, i) => (
              <div key={i} style={{ display: 'flex', background: l.vuln ? `var(--${l.vuln}-dim)` : 'transparent' }}>
                <span style={{ width: 36, textAlign: 'right', paddingRight: 10, color: l.vuln ? SEV_META[l.vuln].color : 'var(--text-tertiary)' }}>{l.n}</span>
                {l.vuln && <span style={{ width: 8, height: 8, borderRadius: '50%', background: SEV_META[l.vuln].color, alignSelf: 'center', marginRight: 6, boxShadow: `0 0 5px ${SEV_META[l.vuln].color}` }} />}
                {!l.vuln && <span style={{ width: 14 }} />}
                <span style={{ color: l.vuln ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{l.code}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel — narrower than desktop */}
        <div style={{
          width: 310, flexShrink: 0,
          background: 'var(--bg-1)',
          borderLeft: '1px solid var(--hairline)',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid var(--hairline)' }}>
            <Icon name="shieldAlert" size={12} color="var(--orange)" />
            <span style={{ fontSize: 12, fontWeight: 700 }}>활동</span>
            <span className="chip chip-critical" style={{ height: 16, fontSize: 8 }}>10</span>
          </div>
          <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6, borderBottom: '1px solid var(--hairline)' }}>
            <div style={{ display: 'flex', gap: 3 }}>
              <Chip tone="critical" active>C 2</Chip>
              <Chip tone="high" active>H 3</Chip>
              <Chip tone="medium">M 3</Chip>
              <Chip tone="low">L 2</Chip>
            </div>
            <div style={{ display: 'flex', gap: 3 }}>
              <Chip tone="critical">EXPLOIT 1</Chip>
              <Chip>미실행 7</Chip>
            </div>
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            {MOCK_VULNS.slice(0, 5).map((v, i) => (
              <div key={v.id} style={{
                padding: '10px 12px',
                borderBottom: '1px solid var(--hairline)',
                borderLeft: i === 0 ? `2px solid ${SEV_META[v.severity].color}` : '2px solid transparent',
                background: i === 0 ? 'var(--surface-hover)' : 'transparent',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                  <span className="severity-dot" style={{ background: SEV_META[v.severity].color }} />
                  <span style={{ fontSize: 11, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.type}</span>
                </div>
                <div className="mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{v.file}:{v.line}</div>
              </div>
            ))}
          </div>
          {/* Floating chat bubble */}
          <div style={{ padding: 10, borderTop: '1px solid var(--hairline)' }}>
            <button style={{
              width: '100%', padding: '8px 10px', borderRadius: 8,
              background: 'linear-gradient(135deg, var(--orange-dim), rgba(129,140,248,0.10))',
              border: '1px solid rgba(249,115,22,0.30)',
              color: 'var(--text-primary)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left',
            }}>
              <Icon name="sparkle" size={13} color="var(--orange)" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700 }}>AI 에이전트에게 질문</div>
                <div style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>이 파일 컨텍스트 활성</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </WindowChrome>
  );
}

// Tablet dashboard (compact 2-column)
function TabletDashboard({ width = 1024, height = 768 }) {
  return (
    <WindowChrome width={width} height={height} title="Pagori · iPad — Dashboard">
      <div style={{
        height: 44, flexShrink: 0, background: 'var(--bg-1)',
        borderBottom: '1px solid var(--hairline)',
        display: 'flex', alignItems: 'center', padding: '0 14px', gap: 10,
      }}>
        <PagoriLockup size={20} />
        <div style={{ width: 1, height: 16, background: 'var(--hairline)' }} />
        <span style={{ fontSize: 12, fontWeight: 700 }}>대시보드</span>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', padding: 2, background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 6, height: 24 }}>
          {['24h','7일','30일'].map((r, i) => (
            <button key={r} style={{
              padding: '0 10px', border: 'none', borderRadius: 4,
              background: i === 1 ? 'var(--bg-1)' : 'transparent',
              color: i === 1 ? 'var(--text-primary)' : 'var(--text-tertiary)',
              fontSize: 10, fontWeight: 600, cursor: 'pointer',
            }}>{r}</button>
          ))}
        </div>
        <button className="btn btn-sm"><Icon name="download" size={11} />PDF</button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg-0)', padding: 16 }}>
        {/* Hero (smaller) */}
        <div style={{
          padding: 18, borderRadius: 12,
          background: 'radial-gradient(circle at 30% 0%, var(--orange-dim) 0%, transparent 50%), var(--bg-1)',
          border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 18,
          marginBottom: 14,
        }}>
          <div style={{
            width: 104, height: 104, borderRadius: 12, flexShrink: 0,
            background: 'var(--bg-2)', border: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>보안 점수</span>
            <span className="mono" style={{ fontSize: 36, fontWeight: 700, color: 'var(--orange)', lineHeight: 1, margin: '4px 0' }}>62</span>
            <span style={{ fontSize: 9, color: 'var(--low)' }}>↑ +7</span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, color: 'var(--text-tertiary)', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>shop-api · main · 7일</div>
            <h1 style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.3, marginBottom: 8, letterSpacing: '-0.01em' }}>
              즉시 조치 필요한 취약점 <span style={{ color: 'var(--critical)' }}>2건</span>
            </h1>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 10 }}>
              SQL Injection · 하드코딩된 시크릿 — AI 패치 적용 시 89점까지 상승합니다.
            </p>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-sm btn-primary"><Icon name="zap" size={10} fill="currentColor" />패치 검토</button>
              <button className="btn btn-sm">취약점 보기</button>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 110 }}>
            {[
              { label: 'CRITICAL', count: 2, color: 'var(--critical)' },
              { label: 'HIGH', count: 3, color: 'var(--high)' },
              { label: 'MEDIUM', count: 3, color: 'var(--medium)' },
              { label: 'LOW', count: 2, color: 'var(--low)' },
            ].map(r => (
              <div key={r.label} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '4px 10px', borderRadius: 6,
                background: 'var(--bg-2)', border: '1px solid var(--border)',
              }}>
                <span className="severity-dot" style={{ background: r.color }} />
                <span style={{ flex: 1, fontSize: 9, fontWeight: 700, color: r.color, fontFamily: 'var(--font-mono)' }}>{r.label}</span>
                <span className="mono" style={{ fontSize: 13, fontWeight: 700 }}>{r.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 2-column grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 10 }}>점수 트렌드</div>
            <svg viewBox="0 0 320 70" style={{ width: '100%', height: 70 }}>
              <defs>
                <linearGradient id="t-trend-g" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--orange)" stopOpacity="0.30" />
                  <stop offset="100%" stopColor="var(--orange)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M0,46 L46,40 L92,36 L138,28 L184,20 L230,16 L276,24 L320,8 L320,70 L0,70 Z" fill="url(#t-trend-g)" />
              <path d="M0,46 L46,40 L92,36 L138,28 L184,20 L230,16 L276,24 L320,8" fill="none" stroke="var(--orange)" strokeWidth="2" />
            </svg>
          </div>
          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 10 }}>우선순위 (3건)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {MOCK_VULNS.slice(0, 3).map((v, i) => (
                <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 18, height: 18, borderRadius: 4, background: SEV_META[v.severity].dim, color: SEV_META[v.severity].color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{i+1}</span>
                  <span style={{ flex: 1, fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.type}</span>
                  <Icon name="chevronRight" size={10} color="var(--text-tertiary)" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </WindowChrome>
  );
}

Object.assign(window, { MobileCollection, TabletEditor, TabletDashboard, MobileChatClosed, MobileChatBubbleM, MobileChatBubbleL });
