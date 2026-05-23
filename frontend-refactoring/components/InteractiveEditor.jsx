/* global React, Icon, Chip, WindowChrome, SEV_META, MOCK_VULNS, PagoriLockup, PagoriMark */
// InteractiveEditor.jsx — Fully clickable / stateful version of V4 Hybrid.
//
// Interactions that actually work here:
//   • Sidebar toggle (top-left button)
//   • Floating chat: single click bubble → popup · X → closed · ⤢ → docked
//   • Filter chips (severity/DAST/API): click to toggle
//   • Vuln rows: click = select · ⌘/Ctrl-click = multi · ⇧-click = range
//   • When 2+ selected, bulk action bar slides in
//   • Right-click on a vuln row → context menu
//   • @ in chat input → mention dropdown
//   • Theme toggle (from Tweaks) flows through

const { useState: useStateIE, useEffect: useEffectIE, useRef: useRefIE } = React;

// Reuse the chat bubble + popup atoms from EditorV4Hybrid via window — but those
// take rendered props; we re-implement minimal ones here so click handlers wire.

function IEHeader({ sidebarOpen, onToggleSidebar, activeApi }) {
  return (
    <div style={{
      height: 48, flexShrink: 0,
      background: 'var(--bg-1)',
      borderBottom: '1px solid var(--hairline)',
      display: 'flex', alignItems: 'center', padding: '0 12px 0 8px', gap: 12,
    }}>
      <button onClick={onToggleSidebar} title="사이드바 토글" style={{
        width: 28, height: 28, borderRadius: 6,
        background: sidebarOpen ? 'var(--orange-dim)' : 'transparent',
        border: 'none',
        color: sidebarOpen ? 'var(--orange)' : 'var(--text-secondary)',
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.15s, color 0.15s',
      }}>
        <Icon name="panel" size={14} />
      </button>

      <PagoriLockup size={22} />

      <div style={{ width: 1, height: 18, background: 'var(--hairline)' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-on-bg)', fontFamily: 'var(--font-mono)' }}>
        <span style={{ cursor: 'pointer', padding: '3px 6px', borderRadius: 4 }}>shop-api</span>
        <Icon name="chevronRight" size={11} color="var(--text-tertiary)" />
        <span style={{ cursor: 'pointer', padding: '3px 6px', borderRadius: 4 }}>api</span>
        <Icon name="chevronRight" size={11} color="var(--text-tertiary)" />
        <span style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '3px 6px', borderRadius: 4,
          background: 'var(--orange-dim)',
          border: '1px solid rgba(249,115,22,0.30)',
          color: 'var(--orange)',
          fontFamily: 'var(--font-mono)', fontWeight: 600,
        }}>
          {activeApi}
          <Icon name="chevronDown" size={10} />
        </span>
        <Icon name="chevronRight" size={11} color="var(--text-tertiary)" />
        <span style={{ color: 'var(--text-active)', padding: '3px 6px' }}>route.ts</span>
      </div>

      <div style={{ flex: 1 }} />

      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        height: 26, padding: '0 8px 0 10px',
        background: 'var(--bg-3)', border: '1px solid var(--border)',
        borderRadius: 6, color: 'var(--text-tertiary)',
        fontSize: 11, minWidth: 220,
      }}>
        <Icon name="search" size={12} />
        <span style={{ flex: 1 }}>검색</span>
        <span className="mono" style={{ padding: '2px 5px', borderRadius: 3, background: 'var(--bg-1)', border: '1px solid var(--border)', fontSize: 9, fontWeight: 600 }}>⌘K</span>
      </div>

      <button className="btn btn-primary" style={{ height: 28 }}>
        <Icon name="play" size={11} fill="currentColor" />분석 시작
      </button>
    </div>
  );
}

// Slim or expanded sidebar — controlled by parent state
function IESidebar({ open, onClose }) {
  const nav = [
    { icon: 'folder', label: '파일', active: true, badge: 8 },
    { icon: 'shieldAlert', label: '취약점', badge: 10 },
    { icon: 'package', label: 'SBOM' },
    { icon: 'history', label: '이력' },
    { icon: 'settings', label: '설정' },
  ];

  if (!open) {
    return (
      <div style={{
        width: 52, flexShrink: 0,
        background: 'var(--bg-1)',
        borderRight: '1px solid var(--hairline)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '12px 0', gap: 4,
      }}>
        {nav.map((b, i) => (
          <button key={i} title={b.label} style={{
            position: 'relative', width: 36, height: 36, borderRadius: 8,
            background: b.active ? 'var(--orange-dim)' : 'transparent',
            color: b.active ? 'var(--orange)' : 'var(--text-tertiary)',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name={b.icon} size={16} />
            {b.badge && (
              <span style={{
                position: 'absolute', top: 3, right: 3, minWidth: 13, height: 13, borderRadius: 7,
                background: 'var(--critical)', color: '#fff', fontSize: 8, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px',
              }}>{b.badge}</span>
            )}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div style={{
      width: 240, flexShrink: 0, background: 'var(--bg-1)',
      borderRight: '1px solid var(--hairline)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '8px 8px',
        borderBottom: '1px solid var(--hairline)',
      }}>
        {nav.map((b, i) => (
          <button key={i} style={{
            position: 'relative', width: 30, height: 30, borderRadius: 6,
            background: b.active ? 'var(--orange-dim)' : 'transparent',
            color: b.active ? 'var(--orange)' : 'var(--text-tertiary)',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name={b.icon} size={14} />
            {b.badge && (
              <span style={{
                position: 'absolute', top: 1, right: 1, minWidth: 11, height: 11, borderRadius: 6,
                background: 'var(--critical)', color: '#fff', fontSize: 7, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 2px',
              }}>{b.badge}</span>
            )}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button onClick={onClose} title="접기" style={{
          width: 26, height: 26, borderRadius: 5, background: 'transparent',
          border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="chevronLeft" size={12} />
        </button>
      </div>

      <div style={{ padding: '12px 14px 4px', fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' }}>
        FILES
      </div>
      <div style={{ flex: 1, overflow: 'auto', fontFamily: 'var(--font-mono)' }}>
        {[
          { d:0, n:'src', icon:'folderOpen', f:1, open:1 },
          { d:1, n:'app', icon:'folderOpen', f:1, open:1 },
          { d:2, n:'api', icon:'folderOpen', f:1, open:1 },
          { d:3, n:'users', icon:'folderOpen', f:1, open:1 },
          { d:4, n:'route.ts', icon:'file', vulns:1, active:1 },
          { d:3, n:'auth', icon:'folder', f:1 },
          { d:2, n:'page.tsx', icon:'file', vulns:1 },
          { d:1, n:'components', icon:'folderOpen', f:1, open:1 },
          { d:2, n:'comment.tsx', icon:'file', vulns:1 },
          { d:1, n:'lib', icon:'folder', f:1 },
          { d:1, n:'middleware.ts', icon:'file', vulns:1 },
        ].map((r, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: `4px 10px 4px ${8 + r.d * 12}px`,
            fontSize: 12, cursor: 'pointer',
            background: r.active ? 'var(--orange-dim)' : 'transparent',
            borderLeft: r.active ? '2px solid var(--orange-2)' : '2px solid transparent',
            color: r.active ? 'var(--text-active)' : 'var(--text-on-bg)',
          }}>
            {r.f && <Icon name={r.open ? 'chevronDown' : 'chevronRight'} size={11} color="var(--text-tertiary)" />}
            {!r.f && <span style={{ width: 11 }} />}
            <Icon name={r.icon} size={12} color={r.f && r.open ? 'var(--orange)' : 'var(--text-tertiary)'} />
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.n}</span>
            {r.vulns > 0 && (
              <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: 'var(--critical-dim)', color: 'var(--critical)' }}>{r.vulns}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Compact code editor
function IECode() {
  const lines = [
    { n: 38, t: 'export async function GET(req: Request) {' },
    { n: 39, t: '  const { searchParams } = new URL(req.url);' },
    { n: 40, t: "  const userId = searchParams.get('id');" },
    { n: 41, t: '  // 🔴 Critical: SQL injection', vuln: 'critical' },
    { n: 42, t: '  const query = `SELECT * FROM users WHERE id = ${userId}`;', vuln: 'critical' },
    { n: 43, t: '  const rows = await db.query(query);' },
    { n: 44, t: '  return Response.json(rows);' },
    { n: 45, t: '}' },
  ];
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
      <div style={{
        height: 34, flexShrink: 0, background: 'var(--bg-1)',
        borderBottom: '1px solid var(--hairline)',
        display: 'flex',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px',
          background: 'var(--bg-0)',
          borderRight: '1px solid var(--hairline)',
          borderTop: '1.5px solid var(--orange-2)',
          fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-active)',
        }}>
          <span className="severity-dot" style={{ background: 'var(--critical)' }} />
          route.ts
          <Icon name="x" size={11} color="var(--text-tertiary)" />
        </div>
      </div>
      <div style={{
        flex: 1, minHeight: 0, overflow: 'auto', background: 'var(--bg-0)',
        fontFamily: 'var(--font-mono)', fontSize: 12.5, lineHeight: '20px', padding: '12px 0',
      }}>
        {lines.map((l, i) => (
          <div key={i} style={{ display: 'flex', background: l.vuln ? `var(--${l.vuln}-dim)` : 'transparent' }}>
            <span style={{
              width: 44, textAlign: 'right', paddingRight: 12,
              color: l.vuln ? SEV_META[l.vuln].color : 'var(--text-tertiary)',
              userSelect: 'none', flexShrink: 0,
            }}>{l.n}</span>
            {l.vuln && <span style={{ width: 10, marginRight: 8, alignSelf: 'center', height: 8, borderRadius: 5, background: SEV_META[l.vuln].color, boxShadow: `0 0 6px ${SEV_META[l.vuln].color}` }} />}
            {!l.vuln && <span style={{ width: 18 }} />}
            <span style={{ color: 'var(--text-on-bg)' }}>{l.t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Right panel with all the interactive behavior ────────────
function IERightPanel({
  selectedIds, onToggleSelect, onClearSelection,
  sevFilter, setSevFilter, dastFilter, setDastFilter, apiFilter, setApiFilter,
  contextFor, onOpenContext, onCloseContext,
  onAskAi, onApplyPatch,
}) {
  const filteredVulns = MOCK_VULNS.filter(v => {
    if (sevFilter.size > 0 && !sevFilter.has(v.severity)) return false;
    if (dastFilter.size > 0) {
      const isExploited = v.tags.includes('DAST_EXPLOITED');
      const isDone = v.tags.includes('DAST_DONE') && !isExploited;
      const isPending = !isExploited && !isDone;
      const matches = (dastFilter.has('exploited') && isExploited)
        || (dastFilter.has('safe') && isDone)
        || (dastFilter.has('pending') && isPending);
      if (!matches) return false;
    }
    return true;
  });

  const counts = {
    critical: MOCK_VULNS.filter(v => v.severity === 'critical').length,
    high: MOCK_VULNS.filter(v => v.severity === 'high').length,
    medium: MOCK_VULNS.filter(v => v.severity === 'medium').length,
    low: MOCK_VULNS.filter(v => v.severity === 'low').length,
  };

  // Group by severity
  const groups = ['critical','high','medium','low'].map(sev => ({
    sev, items: filteredVulns.filter(v => v.severity === sev),
  })).filter(g => g.items.length > 0);

  return (
    <div style={{
      width: 380, flexShrink: 0,
      background: 'var(--bg-1)',
      borderLeft: '1px solid var(--hairline)',
      display: 'flex', flexDirection: 'column', position: 'relative',
    }}>
      <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--hairline)' }}>
        <Icon name="shieldAlert" size={13} color="var(--orange)" />
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-active)' }}>활동</span>
        <span className="chip chip-critical" style={{ height: 18, fontSize: 9 }}>{filteredVulns.length}/{MOCK_VULNS.length}</span>
      </div>

      {/* Filters — clickable */}
      <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8, borderBottom: '1px solid var(--hairline)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 36, fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>심각도</span>
          {['critical','high','medium','low'].map(sev => (
            <button key={sev}
              onClick={() => {
                const next = new Set(sevFilter);
                if (next.has(sev)) next.delete(sev); else next.add(sev);
                setSevFilter(next);
              }}
              className={`chip chip-${sev} ${sevFilter.has(sev) ? 'chip-active' : ''}`}
              style={{ cursor: 'pointer', opacity: sevFilter.size > 0 && !sevFilter.has(sev) ? 0.4 : 1 }}
            >
              {sev[0].toUpperCase()} {counts[sev]}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 36, fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>DAST</span>
          {[
            { id: 'exploited', label: 'EXPLOITED 1', tone: 'critical' },
            { id: 'safe', label: 'SAFE 2', tone: 'low' },
            { id: 'pending', label: '미실행 7', tone: 'default' },
          ].map(f => (
            <button key={f.id}
              onClick={() => {
                const next = new Set(dastFilter);
                if (next.has(f.id)) next.delete(f.id); else next.add(f.id);
                setDastFilter(next);
              }}
              className={`chip ${f.tone === 'default' ? '' : 'chip-' + f.tone} ${dastFilter.has(f.id) ? 'chip-active' : ''}`}
              style={{ cursor: 'pointer', opacity: dastFilter.size > 0 && !dastFilter.has(f.id) ? 0.4 : 1 }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Vuln rows */}
      <div style={{ flex: 1, overflow: 'auto', paddingBottom: selectedIds.size > 0 ? 70 : 0 }}>
        {groups.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>
            <Icon name="search" size={32} color="var(--text-disabled)" />
            <div style={{ marginTop: 12 }}>이 필터에 해당하는 취약점이 없어요</div>
          </div>
        )}
        {groups.map(g => (
          <div key={g.sev}>
            <div style={{ padding: '8px 14px', background: 'var(--bg-2)', borderBottom: '1px solid var(--hairline)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="severity-dot" style={{ background: SEV_META[g.sev].color }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: SEV_META[g.sev].color, letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>{SEV_META[g.sev].label}</span>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>· {g.items.length}건</span>
            </div>
            {g.items.map(v => {
              const isSelected = selectedIds.has(v.id);
              return (
                <div key={v.id}
                  onClick={(e) => onToggleSelect(v.id, e)}
                  onContextMenu={(e) => { e.preventDefault(); onOpenContext(v.id); }}
                  style={{
                    position: 'relative',
                    padding: '10px 12px 10px 32px',
                    borderBottom: '1px solid var(--hairline)',
                    background: isSelected ? 'var(--orange-dim)' : 'transparent',
                    borderLeft: isSelected ? '2px solid var(--orange-2)' : '2px solid transparent',
                    cursor: 'pointer',
                  }}>
                  <span style={{
                    position: 'absolute', top: 13, left: 10,
                    width: 14, height: 14, borderRadius: 3,
                    border: `1.5px solid ${isSelected ? 'var(--orange-2)' : 'var(--border-3)'}`,
                    background: isSelected ? 'var(--orange-2)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    opacity: selectedIds.size > 0 || isSelected ? 1 : 0.5,
                  }}>
                    {isSelected && <Icon name="check" size={10} color="#fff" stroke={3} />}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span className="severity-dot" style={{ background: SEV_META[v.severity].color }} />
                    <span style={{ fontSize: 12, fontWeight: 600, flex: 1, color: 'var(--text-active)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.type}</span>
                  </div>
                  <div className="mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{v.file}:{v.line}</div>
                  {contextFor === v.id && (
                    <div style={{
                      position: 'absolute', top: 30, left: 60, zIndex: 30,
                      width: 220, background: 'var(--bg-2)',
                      border: '1px solid var(--border-2)', borderRadius: 8,
                      boxShadow: '0 12px 32px rgba(0,0,0,0.55)', padding: 4,
                    }}>
                      {[
                        { icon:'sparkle', label:'AI에게 질문', kbd:'↵', onClick: () => { onAskAi(v.id); onCloseContext(); } },
                        { icon:'eye', label:'상세 보기', kbd:'⌘D' },
                        { icon:'terminal', label:'DAST 실행', kbd:'⌘T' },
                        { icon:'zap', label:'패치 적용', kbd:'⌘P', onClick: () => { onApplyPatch(v.id); onCloseContext(); } },
                        { type:'divider' },
                        { icon:'copy', label:'복사' },
                        { icon:'xCircle', label:'무시', tone:'var(--text-tertiary)' },
                      ].map((it, i) => {
                        if (it.type === 'divider') return <div key={i} style={{ height: 1, background: 'var(--hairline)', margin: '4px 0' }} />;
                        return (
                          <div key={i}
                            onClick={(e) => { e.stopPropagation(); if (it.onClick) it.onClick(); else onCloseContext(); }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              padding: '6px 10px', borderRadius: 5,
                              cursor: 'pointer', fontSize: 12,
                              color: it.tone || 'var(--text-primary)',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-hover)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <Icon name={it.icon} size={12} />
                            <span style={{ flex: 1 }}>{it.label}</span>
                            {it.kbd && <span className="mono" style={{ fontSize: 9, color: 'var(--text-tertiary)', padding: '1px 4px', borderRadius: 3, background: 'var(--bg-3)' }}>{it.kbd}</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div style={{
          position: 'absolute', left: 12, right: 12, bottom: 12,
          padding: '10px 12px', borderRadius: 10,
          background: 'var(--bg-0)',
          border: '1px solid var(--orange)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.55)',
          display: 'flex', alignItems: 'center', gap: 10,
          animation: 'fadein .2s',
        }}>
          <div style={{ width: 24, height: 24, borderRadius: 5, background: 'var(--orange-2)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{selectedIds.size}</div>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-active)' }}>개 선택됨</span>
          <div style={{ flex: 1 }} />
          <button className="btn btn-sm" style={{ height: 24 }}><Icon name="zap" size={10} />패치</button>
          <button className="btn btn-sm" style={{ height: 24 }}><Icon name="terminal" size={10} />DAST</button>
          <button onClick={onClearSelection} title="모두 해제" className="btn btn-sm btn-ghost" style={{ height: 24, width: 24, padding: 0, justifyContent: 'center' }}>
            <Icon name="x" size={11} />
          </button>
        </div>
      )}
    </div>
  );
}

// Floating chat bubble + popup + docked
function IEChat({ state, onOpen, onClose, onDockToggle, mentioned, askedAbout }) {
  if (state === 'closed') {
    return (
      <div style={{ position: 'absolute', bottom: 20, right: 24, zIndex: 30, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          padding: '6px 10px', borderRadius: 8,
          background: 'var(--bg-1)', border: '1px solid var(--border)',
          fontSize: 10, color: 'var(--text-on-bg)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}>한 번 클릭 · AI에게 질문</div>
        <button onClick={onOpen} style={{
          position: 'relative',
          width: 52, height: 52, borderRadius: 26,
          background: 'linear-gradient(135deg, var(--orange) 0%, var(--orange-2) 100%)',
          border: 'none', color: '#fff',
          boxShadow: '0 8px 24px rgba(234,88,12,0.50), 0 0 0 1px rgba(255,255,255,0.10) inset',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="sparkle" size={22} color="#fff" stroke={2} />
          <span style={{
            position: 'absolute', top: -2, right: -2,
            minWidth: 18, height: 18, borderRadius: 9,
            background: 'var(--critical)', color: '#fff',
            fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid var(--bg-0)',
          }}>1</span>
        </button>
      </div>
    );
  }

  if (state === 'popup') {
    return (
      <div style={{
        position: 'absolute', bottom: 20, right: 24, zIndex: 30,
        width: 380, height: 480,
        background: 'var(--bg-1)',
        border: '1px solid var(--border-2)',
        borderRadius: 12,
        boxShadow: '0 16px 48px rgba(0,0,0,0.55)',
        display: 'flex', flexDirection: 'column',
        animation: 'fadein .2s',
      }}>
        <div onDoubleClick={onDockToggle}
          style={{
            padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8,
            borderBottom: '1px solid var(--hairline)',
            background: 'var(--bg-2)', borderRadius: '12px 12px 0 0',
            cursor: 'grab',
          }}>
          <div style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--orange-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="sparkle" size={12} color="var(--orange)" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-active)' }}>Pagori 보안 에이전트</div>
            <div style={{ fontSize: 9, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>더블클릭 → 오른쪽 패널에 고정</div>
          </div>
          <button onClick={onDockToggle} title="도크" style={{ width: 22, height: 22, borderRadius: 5, border: 'none', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="panel" size={11} />
          </button>
          <button onClick={onClose} title="닫기" style={{ width: 22, height: 22, borderRadius: 5, border: 'none', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="x" size={11} />
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ width: 22, height: 22, borderRadius: 5, background: 'var(--orange-dim)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="sparkle" size={11} color="var(--orange)" />
            </div>
            <div>
              <div style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text-on-bg)' }}>
                {askedAbout
                  ? <>좋아요, <strong style={{ color: 'var(--text-active)' }}>{askedAbout}</strong>의 패치는 parameterized query 사용입니다. 위 패치 카드를 적용해주세요.</>
                  : <>안녕하세요. 어떤 취약점에 대해 도와드릴까요? 오른쪽 패널에서 우클릭 → "AI에게 질문" 으로도 호출 가능해요.</>}
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: 10, borderTop: '1px solid var(--hairline)' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 10px', background: 'var(--bg-3)', borderRadius: 8,
            border: `1px solid ${mentioned ? 'var(--orange-2)' : 'var(--border)'}`,
          }}>
            <span style={{ flex: 1, fontSize: 12, color: 'var(--text-tertiary)' }}>
              <span className="mono">@</span> 취약점 · <span className="mono">#</span> 태그
            </span>
            <button style={{ width: 22, height: 22, borderRadius: 5, background: 'var(--orange-2)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <Icon name="arrowRight" size={11} stroke={2.2} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null; // 'docked' rendered separately
}

// Docked variant (when chat is in right panel)
function IEDockedChat({ onClose, onUndock }) {
  return (
    <div style={{ width: 380, flexShrink: 0, background: 'var(--bg-1)', borderLeft: '1px solid var(--hairline)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--hairline)', background: 'var(--bg-2)' }}>
        <div style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--orange-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="sparkle" size={12} color="var(--orange)" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-active)' }}>AI 채팅 · 도크됨</div>
          <div style={{ fontSize: 9, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>v1 SQL Injection 컨텍스트</div>
        </div>
        <button onClick={onUndock} title="플로팅" style={{ width: 22, height: 22, borderRadius: 5, border: 'none', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="externalLink" size={11} />
        </button>
        <button onClick={onClose} title="활동 패널로" style={{ width: 22, height: 22, borderRadius: 5, border: 'none', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="x" size={11} />
        </button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 16, color: 'var(--text-on-bg)', fontSize: 13, lineHeight: 1.6 }}>
        <div style={{ marginBottom: 14 }}>
          <code style={{ background: 'var(--bg-3)', padding: '1px 5px', borderRadius: 3, fontSize: 11 }}>api/users/route.ts:42</code>의 SQL Injection은 다음과 같이 익스플로잇됩니다:
        </div>
        <div style={{ padding: 12, background: 'var(--bg-0)', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: 11, marginBottom: 10, lineHeight: 1.6 }}>
          <span style={{ color: 'var(--info)' }}>GET</span> /api/users?id=<span style={{ color: 'var(--critical)' }}>1' OR '1'='1</span>
        </div>
        <div>parameterized query 패치를 적용하면 즉시 안전해집니다.</div>
      </div>
      <div style={{ padding: 12, borderTop: '1px solid var(--hairline)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--bg-3)', borderRadius: 8, border: '1px solid var(--border)' }}>
          <span style={{ flex: 1, fontSize: 12, color: 'var(--text-tertiary)' }}>답변을 입력하세요…</span>
          <button style={{ width: 22, height: 22, borderRadius: 5, background: 'var(--orange-2)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Icon name="arrowRight" size={11} stroke={2.2} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main interactive editor ────────────────────────────────
function InteractiveEditor({ width = 1440, height = 900 }) {
  const [sidebarOpen, setSidebarOpen] = useStateIE(false);
  const [chatState, setChatState] = useStateIE('closed'); // 'closed' | 'popup' | 'docked'
  const [askedAbout, setAskedAbout] = useStateIE(null);
  const [selectedIds, setSelectedIds] = useStateIE(new Set());
  const [lastSelectedId, setLastSelectedId] = useStateIE(null);
  const [sevFilter, setSevFilter] = useStateIE(new Set());
  const [dastFilter, setDastFilter] = useStateIE(new Set());
  const [apiFilter, setApiFilter] = useStateIE('users');
  const [contextFor, setContextFor] = useStateIE(null);
  const [toast, setToast] = useStateIE(null);

  // Close context menu when clicking elsewhere
  useEffectIE(() => {
    if (!contextFor) return;
    const close = () => setContextFor(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [contextFor]);

  // Auto-dismiss toast
  useEffectIE(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(id);
  }, [toast]);

  const onToggleSelect = (id, e) => {
    const ordered = MOCK_VULNS.map(v => v.id);
    const next = new Set(selectedIds);
    if (e.shiftKey && lastSelectedId) {
      const a = ordered.indexOf(lastSelectedId), b = ordered.indexOf(id);
      const [lo, hi] = a < b ? [a, b] : [b, a];
      for (let i = lo; i <= hi; i++) next.add(ordered[i]);
    } else if (e.metaKey || e.ctrlKey) {
      if (next.has(id)) next.delete(id); else next.add(id);
    } else {
      if (next.size === 1 && next.has(id)) next.clear();
      else { next.clear(); next.add(id); }
    }
    setSelectedIds(next);
    setLastSelectedId(id);
  };

  const onAskAi = (id) => {
    const v = MOCK_VULNS.find(x => x.id === id);
    setAskedAbout(v?.type);
    setChatState('popup');
    setToast(`AI 채팅 열림 · ${v?.type} 컨텍스트 활성`);
  };

  const onApplyPatch = (id) => {
    const v = MOCK_VULNS.find(x => x.id === id);
    setToast(`✓ ${v?.type} 패치가 적용되었습니다`);
  };

  return (
    <WindowChrome width={width} height={height} title="Pagori Editor · 인터랙티브 (실제 클릭 작동)">
      <IEHeader sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen(o => !o)} activeApi={apiFilter} />

      {/* Progress strip */}
      <div style={{ height: 28, flexShrink: 0, background: 'var(--bg-1)', borderBottom: '1px solid var(--hairline)', display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px' }}>
        <span className="severity-dot" style={{ background: 'var(--orange)', animation: 'pulse-dot 1.4s infinite' }} />
        <span style={{ fontSize: 10, fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text-on-bg)' }}>분석 중 · SAST 4/7</span>
        <div style={{ flex: 1, maxWidth: 280 }}>
          <div className="progress-track"><div className="progress-fill" style={{ width: '57%' }} /></div>
        </div>
        <span className="mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>현재: lib/auth.ts</span>
        <div style={{ flex: 1 }} />
        <span className="mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>12.4k tokens · $0.0234</span>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0, position: 'relative' }}>
        <IESidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <IECode />
        </div>

        {chatState === 'docked'
          ? <IEDockedChat onClose={() => setChatState('closed')} onUndock={() => setChatState('popup')} />
          : <IERightPanel
              selectedIds={selectedIds}
              onToggleSelect={onToggleSelect}
              onClearSelection={() => setSelectedIds(new Set())}
              sevFilter={sevFilter} setSevFilter={setSevFilter}
              dastFilter={dastFilter} setDastFilter={setDastFilter}
              apiFilter={apiFilter} setApiFilter={setApiFilter}
              contextFor={contextFor}
              onOpenContext={setContextFor}
              onCloseContext={() => setContextFor(null)}
              onAskAi={onAskAi}
              onApplyPatch={onApplyPatch}
            />
        }

        {chatState !== 'docked' && (
          <IEChat
            state={chatState}
            onOpen={() => setChatState('popup')}
            onClose={() => { setChatState('closed'); setAskedAbout(null); }}
            onDockToggle={() => setChatState(s => s === 'docked' ? 'popup' : 'docked')}
            askedAbout={askedAbout}
          />
        )}

        {/* Floating help banner — only on first load */}
        <div style={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
          padding: '6px 14px', borderRadius: 999,
          background: 'rgba(249,115,22,0.18)',
          border: '1px solid rgba(249,115,22,0.30)',
          fontSize: 11, color: 'var(--orange)',
          display: 'flex', alignItems: 'center', gap: 8,
          pointerEvents: 'none',
          zIndex: 5,
        }}>
          <Icon name="sparkle" size={11} />
          <span>실제로 클릭됩니다 — 사이드바, 필터, 채팅 버블, 우클릭 메뉴, ⌘+클릭 다중선택</span>
        </div>

        {/* Toast */}
        {toast && (
          <div style={{
            position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
            padding: '10px 16px', borderRadius: 8,
            background: 'var(--bg-0)',
            border: '1px solid var(--low)',
            boxShadow: '0 12px 32px rgba(0,0,0,0.55)',
            fontSize: 12, color: 'var(--text-active)',
            display: 'flex', alignItems: 'center', gap: 8,
            animation: 'fadein .2s',
            zIndex: 50,
          }}>
            <Icon name="check" size={12} color="var(--low)" stroke={2.4} />{toast}
          </div>
        )}
      </div>
    </WindowChrome>
  );
}

Object.assign(window, { InteractiveEditor });
