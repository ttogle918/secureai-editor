/* global React, Icon, Chip, WindowChrome, SEV_META, MOCK_VULNS, MOCK_FILES */
// EditorV4Hybrid.jsx — Hybrid editor that merges V2 + V3 with new features:
//   - Collapsible sidebar (slim ↔ full file tree)
//   - Floating AI chat bubble (closed → popup → docked)
//   - Right-click context menu on vulns
//   - @mention autocomplete in chat input
//   - DAST status column on vuln rows
//   - Multi-select bulk action bar

const { useState: useStateH } = React;

// ─── Header (shared with other variants) ────────────────────────────
function HybridHeader({ sidebarOpen, onToggleSidebar, activeApi = 'users' }) {
  return (
    <div style={{
      height: 48, flexShrink: 0,
      background: 'var(--bg-1)',
      borderBottom: '1px solid var(--hairline)',
      display: 'flex', alignItems: 'center', padding: '0 12px 0 8px', gap: 12,
    }}>
      <button onClick={onToggleSidebar} style={{
        width: 28, height: 28, borderRadius: 6,
        background: sidebarOpen ? 'var(--orange-dim)' : 'transparent',
        border: 'none', color: sidebarOpen ? 'var(--orange)' : 'var(--text-secondary)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name="panel" size={14} />
      </button>

      <PagoriLockup size={22} />

      <div style={{ width: 1, height: 18, background: 'var(--hairline)' }} />

      {/* Breadcrumb — segments clickable; api/* segment shows dropdown for API filtering */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
        <span style={{ cursor: 'pointer', padding: '3px 6px', borderRadius: 4 }}>shop-api</span>
        <Icon name="chevronRight" size={11} color="var(--text-tertiary)" />
        <span style={{ cursor: 'pointer', padding: '3px 6px', borderRadius: 4 }}>api</span>
        <Icon name="chevronRight" size={11} color="var(--text-tertiary)" />
        {/* Active API group — clickable with dropdown chevron to filter right panel */}
        <button title="이 API 그룹으로 취약점 필터" style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '3px 6px', borderRadius: 4,
          background: 'var(--orange-dim)',
          border: '1px solid rgba(249,115,22,0.30)',
          color: 'var(--orange)', cursor: 'pointer',
          fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600,
        }}>
          {activeApi}
          <Icon name="chevronDown" size={10} />
          <span className="chip chip-critical" style={{ height: 14, fontSize: 8, padding: '0 4px', marginLeft: 2 }}>3</span>
        </button>
        <Icon name="chevronRight" size={11} color="var(--text-tertiary)" />
        <span style={{ color: 'var(--text-primary)', padding: '3px 6px' }}>route.ts</span>
      </div>

      <div style={{ flex: 1 }} />

      <button style={{
        display: 'flex', alignItems: 'center', gap: 8,
        height: 26, padding: '0 8px 0 10px',
        background: 'var(--bg-3)', border: '1px solid var(--border)',
        borderRadius: 6, color: 'var(--text-tertiary)',
        fontSize: 11, cursor: 'pointer', minWidth: 240,
      }}>
        <Icon name="search" size={12} />
        <span style={{ flex: 1, textAlign: 'left' }}>취약점 · 파일 · CVE 검색</span>
        <span className="mono" style={{ padding: '2px 5px', borderRadius: 3, background: 'var(--bg-1)', border: '1px solid var(--border)', fontSize: 9, fontWeight: 600 }}>⌘K</span>
      </button>

      <div style={{ display: 'flex', height: 26, padding: 2, background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 7 }}>
        {['editor','dashboard'].map((v, i) => (
          <button key={v} style={{
            padding: '0 10px', borderRadius: 5, border: 'none',
            background: i === 0 ? 'var(--bg-1)' : 'transparent',
            color: i === 0 ? 'var(--text-primary)' : 'var(--text-tertiary)',
            fontSize: 11, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 5,
            boxShadow: i === 0 ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
          }}>
            <Icon name={v === 'editor' ? 'code' : 'layout'} size={12} />
            {v === 'editor' ? '에디터' : '대시보드'}
          </button>
        ))}
      </div>

      <button style={{
        position: 'relative', width: 28, height: 26, border: '1px solid var(--border)',
        borderRadius: 6, background: 'var(--bg-2)', color: 'var(--text-secondary)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name="bell" size={13} />
        <span style={{
          position: 'absolute', top: -3, right: -3, minWidth: 14, height: 14, borderRadius: 7,
          background: 'var(--orange-2)', color: '#fff', fontSize: 9, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px',
          boxShadow: '0 0 0 2px var(--bg-1)',
        }}>2</span>
      </button>

      <button className="btn btn-primary" style={{ height: 28 }}>
        <Icon name="play" size={11} fill="currentColor" />분석 시작
      </button>
    </div>
  );
}

// ─── Slim sidebar that expands to full ──────────────────────────────
function HybridSidebar({ open, onToggle }) {
  const nav = [
    { icon: 'folder', label: '파일', active: true, badge: 8 },
    { icon: 'shieldAlert', label: '취약점', badge: 10 },
    { icon: 'package', label: 'SBOM' },
    { icon: 'history', label: '분석 이력' },
    { icon: 'users', label: '팀' },
    { icon: 'settings', label: '설정' },
  ];

  if (!open) {
    // Slim rail (V3 style)
    return (
      <div style={{
        width: 52, flexShrink: 0, background: 'var(--bg-1)',
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
        <div style={{ flex: 1 }} />
        <button onClick={onToggle} title="사이드바 펼치기" style={{
          width: 36, height: 36, borderRadius: 8, background: 'transparent', border: 'none',
          color: 'var(--text-tertiary)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="chevronRight" size={14} />
        </button>
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          background: 'linear-gradient(135deg, var(--tag-3), var(--tag-1))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, color: '#fff',
        }}>JM</div>
      </div>
    );
  }

  // Expanded sidebar with file tree
  return (
    <div style={{
      width: 240, flexShrink: 0, background: 'var(--bg-1)',
      borderRight: '1px solid var(--hairline)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Nav strip at top */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 2,
        padding: '8px 8px 8px 8px',
        borderBottom: '1px solid var(--hairline)',
      }}>
        {nav.slice(0, 4).map((b, i) => (
          <button key={i} title={b.label} style={{
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
        <button onClick={onToggle} title="접기" style={{
          width: 26, height: 26, borderRadius: 5, background: 'transparent', border: 'none',
          color: 'var(--text-tertiary)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="chevronLeft" size={12} />
        </button>
      </div>

      <div style={{ padding: '12px 14px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' }}>PROJECT</div>
      </div>
      <div style={{ padding: '0 12px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 10px', borderRadius: 6,
          background: 'var(--bg-3)', border: '1px solid var(--border)',
        }}>
          <Icon name="github" size={12} color="var(--text-secondary)" />
          <span style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>shop-api</span>
          <span className="chip chip-orange" style={{ height: 18, fontSize: 8 }}>main</span>
        </div>
      </div>

      <div style={{ padding: '12px 14px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' }}>FILES</span>
        <Icon name="plus" size={11} color="var(--text-tertiary)" style={{ cursor: 'pointer' }} />
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 0 8px', fontFamily: 'var(--font-mono)' }}>
        <FileTreeMini />
      </div>
    </div>
  );
}

function FileTreeMini() {
  // Reuse the structure but inline (the original FileTree is in EditorVariants.jsx — duplicate light here)
  const Row = ({ depth, name, icon, vulns, selected, isFolder, open }) => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: `4px 10px 4px ${8 + depth * 12}px`,
      fontSize: 12, cursor: 'pointer',
      background: selected ? 'var(--orange-dim)' : 'transparent',
      borderLeft: selected ? '2px solid var(--orange-2)' : '2px solid transparent',
      color: selected ? 'var(--text-primary)' : 'var(--text-secondary)',
    }}>
      {isFolder && <Icon name={open ? 'chevronDown' : 'chevronRight'} size={11} color="var(--text-tertiary)" />}
      {!isFolder && <span style={{ width: 11 }} />}
      <Icon name={icon} size={12} color={isFolder && open ? 'var(--orange)' : 'var(--text-tertiary)'} fill={isFolder && open ? 'var(--orange-dim)' : 'none'} />
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
      {vulns > 0 && (
        <span style={{
          fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
          background: 'var(--critical-dim)', color: 'var(--critical)',
        }}>{vulns}</span>
      )}
    </div>
  );

  return (
    <>
      <Row depth={0} name="src" icon="folderOpen" isFolder open />
      <Row depth={1} name="app" icon="folderOpen" isFolder open />
      <Row depth={2} name="api" icon="folderOpen" isFolder open />
      <Row depth={3} name="users" icon="folderOpen" isFolder open />
      <Row depth={4} name="route.ts" icon="file" vulns={1} selected />
      <Row depth={3} name="auth" icon="folder" isFolder />
      <Row depth={3} name="files" icon="folder" isFolder />
      <Row depth={2} name="page.tsx" icon="file" vulns={1} />
      <Row depth={1} name="components" icon="folderOpen" isFolder open />
      <Row depth={2} name="comment.tsx" icon="file" vulns={1} />
      <Row depth={2} name="Button.tsx" icon="file" />
      <Row depth={1} name="lib" icon="folder" isFolder />
      <Row depth={1} name="utils" icon="folder" isFolder />
      <Row depth={1} name="middleware.ts" icon="file" vulns={1} />
    </>
  );
}

// ─── Code editor (slimmer version, shared) ──────────────────────────
function HybridCode() {
  const lines = [
    { n: 38, code: <><span style={{ color: '#c586c0' }}>export async function</span> <span style={{ color: '#dcdcaa' }}>GET</span>(<span style={{ color: '#9cdcfe' }}>req</span>: <span style={{ color: '#4ec9b0' }}>Request</span>) {'{'}</> },
    { n: 39, code: <>  <span style={{ color: '#c586c0' }}>const</span> {'{'} <span style={{ color: '#9cdcfe' }}>searchParams</span> {'}'} = <span style={{ color: '#c586c0' }}>new</span> <span style={{ color: '#4ec9b0' }}>URL</span>(req.url);</> },
    { n: 40, code: <>  <span style={{ color: '#c586c0' }}>const</span> <span style={{ color: '#9cdcfe' }}>userId</span> = searchParams.<span style={{ color: '#dcdcaa' }}>get</span>(<span style={{ color: '#ce9178' }}>'id'</span>);</> },
    { n: 41, code: <>  <span style={{ color: '#6a9955', fontStyle: 'italic' }}>// 🔴 Critical: SQL injection via unsanitized userId</span></>, vuln: 'critical' },
    { n: 42, code: <>  <span style={{ color: '#c586c0' }}>const</span> <span style={{ color: '#9cdcfe' }}>query</span> = <span style={{ color: '#ce9178' }}>`SELECT * FROM users WHERE id = </span><span style={{ background: 'rgba(240,65,65,0.20)', borderBottom: '2px wavy var(--critical)', color: '#ce9178' }}>${'${userId}'}</span><span style={{ color: '#ce9178' }}>`</span>;</>, vuln: 'critical' },
    { n: 43, code: <>  <span style={{ color: '#c586c0' }}>const</span> <span style={{ color: '#9cdcfe' }}>rows</span> = <span style={{ color: '#c586c0' }}>await</span> db.<span style={{ color: '#dcdcaa' }}>query</span>(query);</> },
    { n: 44, code: <>  <span style={{ color: '#c586c0' }}>return</span> <span style={{ color: '#4ec9b0' }}>Response</span>.<span style={{ color: '#dcdcaa' }}>json</span>(rows);</> },
    { n: 45, code: <>{'}'}</> },
    { n: 46, code: <></> },
    { n: 47, code: <><span style={{ color: '#c586c0' }}>export async function</span> <span style={{ color: '#dcdcaa' }}>POST</span>(<span style={{ color: '#9cdcfe' }}>req</span>: <span style={{ color: '#4ec9b0' }}>Request</span>) {'{'}</> },
    { n: 48, code: <>  <span style={{ color: '#c586c0' }}>const</span> <span style={{ color: '#9cdcfe' }}>body</span> = <span style={{ color: '#c586c0' }}>await</span> req.<span style={{ color: '#dcdcaa' }}>json</span>();</> },
    { n: 49, code: <>  <span style={{ color: '#c586c0' }}>if</span> (!body.email) <span style={{ color: '#c586c0' }}>return</span> <span style={{ color: '#4ec9b0' }}>Response</span>.<span style={{ color: '#dcdcaa' }}>json</span>({'{'} error: <span style={{ color: '#ce9178' }}>'missing'</span> {'}'});</> },
    { n: 50, code: <>  <span style={{ color: '#c586c0' }}>const</span> <span style={{ color: '#9cdcfe' }}>user</span> = <span style={{ color: '#c586c0' }}>await</span> db.users.<span style={{ color: '#dcdcaa' }}>create</span>({'{'} data: body {'}'});</> },
    { n: 51, code: <>  <span style={{ color: '#c586c0' }}>return</span> <span style={{ color: '#4ec9b0' }}>Response</span>.<span style={{ color: '#dcdcaa' }}>json</span>(user);</> },
    { n: 52, code: <>{'}'}</> },
  ];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
      <div style={{
        height: 34, flexShrink: 0, background: 'var(--bg-1)',
        borderBottom: '1px solid var(--hairline)',
        display: 'flex',
      }}>
        {[
          { name: 'route.ts', active: true, vuln: 'critical' },
          { name: 'comment.tsx', vuln: 'high' },
          { name: 'config.ts', vuln: 'critical' },
        ].map((tab) => (
          <div key={tab.name} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px',
            background: tab.active ? 'var(--bg-0)' : 'transparent',
            borderRight: '1px solid var(--hairline)',
            borderTop: tab.active ? '1.5px solid var(--orange-2)' : '1.5px solid transparent',
            fontSize: 12, fontFamily: 'var(--font-mono)',
            color: tab.active ? 'var(--text-primary)' : 'var(--text-secondary)',
            cursor: 'pointer',
          }}>
            <span className="severity-dot" style={{ background: SEV_META[tab.vuln].color }} />
            {tab.name}
            <Icon name="x" size={11} color="var(--text-tertiary)" />
          </div>
        ))}
      </div>

      <div style={{
        flex: 1, minHeight: 0, overflow: 'auto', background: 'var(--bg-0)',
        fontFamily: 'var(--font-mono)', fontSize: 12.5, lineHeight: '20px', padding: '12px 0',
      }}>
        {lines.map((l, i) => (
          <div key={i} style={{ display: 'flex', minWidth: 'max-content', background: l.vuln ? `var(--${l.vuln}-dim)` : 'transparent' }}>
            <span style={{
              width: 44, textAlign: 'right', paddingRight: 12,
              color: l.vuln ? SEV_META[l.vuln].color : 'var(--text-tertiary)',
              userSelect: 'none', flexShrink: 0,
            }}>{l.n}</span>
            {l.vuln && (
              <span style={{
                width: 10, marginRight: 8, alignSelf: 'center',
                height: 8, borderRadius: '50%', background: SEV_META[l.vuln].color,
                boxShadow: `0 0 6px ${SEV_META[l.vuln].color}`,
              }} />
            )}
            {!l.vuln && <span style={{ width: 18 }} />}
            <span style={{ color: 'var(--text-primary)' }}>{l.code}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Activity rail with DAST status + multi-select ──────────────────
function ActivityRailV2({ selectedIds = [], showBulkBar = false, showContextMenu = false, contextMenuFor }) {
  // DAST status mapping
  const dastFor = (v) => {
    if (v.tags.includes('DAST_EXPLOITED')) return { state: 'exploited', label: 'EXPLOITED', tone: 'critical' };
    if (v.tags.includes('DAST_DONE')) return { state: 'safe', label: 'DAST 안전', tone: 'low' };
    return { state: 'pending', label: '미실행', tone: 'default' };
  };

  return (
    <div style={{
      width: 380, flexShrink: 0,
      background: 'var(--bg-1)',
      borderLeft: '1px solid var(--hairline)',
      display: 'flex', flexDirection: 'column', position: 'relative',
    }}>
      <div style={{
        padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 8,
        borderBottom: '1px solid var(--hairline)',
      }}>
        <Icon name="shieldAlert" size={13} color="var(--orange)" />
        <span style={{ fontSize: 13, fontWeight: 700 }}>활동</span>
        <span className="chip chip-critical" style={{ height: 18, fontSize: 9 }}>{MOCK_VULNS.length}</span>
        <div style={{ flex: 1 }} />
        <button style={{ width: 24, height: 24, borderRadius: 5, border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="필터">
          <Icon name="filter" size={11} />
        </button>
        <button style={{ width: 24, height: 24, borderRadius: 5, border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="정렬">
          <Icon name="layers" size={11} />
        </button>
      </div>

      {/* Filter chips — Severity + DAST + API */}
      <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8, borderBottom: '1px solid var(--hairline)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 36, fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>심각도</span>
          <Chip tone="critical" active>C 2</Chip>
          <Chip tone="high" active>H 3</Chip>
          <Chip tone="medium">M 3</Chip>
          <Chip tone="low">L 2</Chip>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 36, fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>DAST</span>
          <Chip tone="critical">EXPLOITED 1</Chip>
          <Chip tone="low">SAFE 2</Chip>
          <Chip active>미실행 7</Chip>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 36, fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>API</span>
          <Chip tone="orange" active>users 3</Chip>
          <Chip>auth 2</Chip>
          <Chip>files 1</Chip>
          <Chip>middleware 2</Chip>
          <Chip>+2</Chip>
        </div>
      </div>

      {/* Vulnerability rows */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {[
          { sev: 'critical', label: 'Critical', items: MOCK_VULNS.filter(v => v.severity === 'critical'), open: true },
          { sev: 'high', label: 'High', items: MOCK_VULNS.filter(v => v.severity === 'high'), open: true },
          { sev: 'medium', label: 'Medium', items: MOCK_VULNS.filter(v => v.severity === 'medium'), open: false },
        ].map((g, gi) => (
          <div key={gi}>
            <div style={{
              padding: '8px 14px',
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'var(--bg-2)',
              borderBottom: '1px solid var(--hairline)',
              cursor: 'pointer',
            }}>
              <Icon name={g.open ? 'chevronDown' : 'chevronRight'} size={11} color="var(--text-tertiary)" />
              <span className="severity-dot" style={{ background: SEV_META[g.sev].color, boxShadow: g.sev === 'critical' ? `0 0 6px ${SEV_META[g.sev].color}` : 'none' }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: SEV_META[g.sev].color, letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>{g.label.toUpperCase()}</span>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>· {g.items.length}건</span>
            </div>

            {g.open && g.items.map((v) => {
              const isSelected = selectedIds.includes(v.id);
              const isActive = v.id === 'v1';
              const dast = dastFor(v);
              return (
                <div key={v.id} className="vuln-row" style={{
                  position: 'relative',
                  padding: '10px 12px 10px 32px',
                  borderBottom: '1px solid var(--hairline)',
                  background: isSelected ? 'var(--orange-dim)' : (isActive ? 'var(--surface-hover)' : 'transparent'),
                  borderLeft: isActive ? `2px solid ${SEV_META[v.severity].color}` : '2px solid transparent',
                  cursor: 'pointer',
                }}>
                  {/* Checkbox — hover-revealed, but shown if any selected */}
                  <span style={{
                    position: 'absolute', top: 13, left: 10,
                    width: 14, height: 14, borderRadius: 3,
                    border: `1.5px solid ${isSelected ? 'var(--orange-2)' : 'var(--border-3)'}`,
                    background: isSelected ? 'var(--orange-2)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    opacity: showBulkBar ? 1 : 0.6,
                  }}>
                    {isSelected && <Icon name="check" size={10} color="#fff" stroke={3} />}
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span className="severity-dot" style={{ background: SEV_META[v.severity].color }} />
                    <span style={{ fontSize: 12, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.type}</span>
                  </div>
                  <div className="mono" style={{ fontSize: 10, color: 'var(--text-tertiary)', display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{v.file}:{v.line}</span>
                    <span>{v.cwe}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    {/* DAST badge */}
                    <span className={`chip chip-${dast.tone === 'default' ? '' : dast.tone}`} style={{ height: 16, fontSize: 8, padding: '0 5px', ...(dast.state === 'pending' ? { background: 'var(--bg-3)', color: 'var(--text-tertiary)', borderColor: 'var(--border)' } : {}) }}>
                      {dast.state === 'exploited' && <span className="severity-dot" style={{ background: SEV_META.critical.color }} />}
                      DAST · {dast.label}
                    </span>
                    {v.tags.filter(t => !t.startsWith('DAST')).slice(0, 1).map(t => (
                      <span key={t} className="chip" style={{ height: 16, fontSize: 8, padding: '0 5px' }}>{t}</span>
                    ))}
                  </div>

                  {/* Hover actions — inline AI / Patch */}
                  <div className="vuln-row-actions" style={{
                    position: 'absolute', top: 8, right: 8,
                    display: isActive ? 'flex' : 'none', gap: 3,
                  }}>
                    <button title="AI에게 물어보기" style={{ width: 22, height: 22, borderRadius: 5, border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--tag-1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                      <Icon name="sparkle" size={11} />
                    </button>
                    <button title="DAST 실행" style={{ width: 22, height: 22, borderRadius: 5, border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                      <Icon name="terminal" size={11} />
                    </button>
                  </div>

                  {/* Context menu attached to this row */}
                  {showContextMenu && contextMenuFor === v.id && (
                    <div style={{
                      position: 'absolute', top: 60, left: 80, zIndex: 20,
                      width: 220, background: 'var(--bg-2)',
                      border: '1px solid var(--border-2)', borderRadius: 8,
                      boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
                      padding: 4,
                    }}>
                      {[
                        { icon: 'sparkle', label: 'AI에게 질문', kbd: '↵', tone: 'var(--tag-1)' },
                        { icon: 'eye', label: '취약점 상세 보기', kbd: '⌘D' },
                        { icon: 'terminal', label: 'DAST 실행', kbd: '⌘T' },
                        { icon: 'zap', label: '패치 적용', kbd: '⌘P', tone: 'var(--low)' },
                        { type: 'divider' },
                        { icon: 'copy', label: '취약점 복사' },
                        { icon: 'externalLink', label: 'CWE/OWASP 참조 열기' },
                        { type: 'divider' },
                        { icon: 'xCircle', label: '이 취약점 무시', tone: 'var(--text-tertiary)' },
                      ].map((item, i) => {
                        if (item.type === 'divider') return <div key={i} style={{ height: 1, background: 'var(--hairline)', margin: '4px 0' }} />;
                        return (
                          <div key={i} style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '6px 10px', borderRadius: 5,
                            background: i === 0 ? 'var(--surface-hover)' : 'transparent',
                            cursor: 'pointer',
                            color: item.tone || 'var(--text-primary)',
                            fontSize: 12,
                          }}>
                            <Icon name={item.icon} size={12} />
                            <span style={{ flex: 1 }}>{item.label}</span>
                            {item.kbd && <span className="mono" style={{ fontSize: 9, color: 'var(--text-tertiary)', padding: '1px 4px', borderRadius: 3, background: 'var(--bg-3)' }}>{item.kbd}</span>}
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

      {/* Bulk action bar — slides in when multi-selected */}
      {showBulkBar && (
        <div style={{
          position: 'absolute', left: 12, right: 12, bottom: 12,
          padding: '10px 12px', borderRadius: 10,
          background: 'var(--bg-0)',
          border: '1px solid var(--orange)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', gap: 10,
          animation: 'fadein .2s',
        }}>
          <div style={{
            width: 24, height: 24, borderRadius: 5,
            background: 'var(--orange-2)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)',
          }}>{selectedIds.length}</div>
          <span style={{ fontSize: 12, fontWeight: 600 }}>개 선택됨</span>
          <div style={{ flex: 1 }} />
          <button className="btn btn-sm" style={{ height: 24 }}><Icon name="zap" size={10} />패치</button>
          <button className="btn btn-sm" style={{ height: 24 }}><Icon name="terminal" size={10} />DAST</button>
          <button className="btn btn-sm btn-ghost" style={{ height: 24, color: 'var(--text-tertiary)' }}><Icon name="x" size={10} />무시</button>
          <button title="모두 해제" className="btn btn-sm btn-ghost" style={{ height: 24, width: 24, padding: 0, justifyContent: 'center' }}><Icon name="x" size={11} /></button>
        </div>
      )}
    </div>
  );
}

// ─── Floating chat bubble (closed state) ────────────────────────────
function ChatBubble({ unread = 1 }) {
  return (
    <div style={{
      position: 'absolute', bottom: 20, right: 24, zIndex: 30,
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      {/* Hint label that fades */}
      <div style={{
        padding: '8px 12px', borderRadius: 8,
        background: 'var(--bg-1)', border: '1px solid var(--border)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
        fontSize: 11, color: 'var(--text-secondary)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-tertiary)' }}>한번 클릭</span>
        <span>·</span>
        <span style={{ fontWeight: 600 }}>AI 채팅</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-tertiary)' }}>(더블클릭 → 도크)</span>
      </div>

      <button style={{
        position: 'relative',
        width: 52, height: 52, borderRadius: 26,
        background: 'linear-gradient(135deg, var(--orange) 0%, var(--orange-2) 100%)',
        border: 'none', color: '#fff',
        boxShadow: '0 8px 24px rgba(234,88,12,0.50), 0 0 0 1px rgba(255,255,255,0.10) inset',
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name="sparkle" size={22} color="#fff" stroke={2} />
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: -2, right: -2,
            minWidth: 18, height: 18, borderRadius: 9,
            background: 'var(--critical)', color: '#fff',
            fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid var(--bg-0)',
          }}>{unread}</span>
        )}
      </button>
    </div>
  );
}

// ─── Floating chat popup (single-click state) ───────────────────────
function ChatPopup({ showMention = false }) {
  return (
    <div style={{
      position: 'absolute', bottom: 20, right: 24, zIndex: 30,
      width: 380, height: 480,
      background: 'var(--bg-1)',
      border: '1px solid var(--border-2)',
      borderRadius: 12,
      boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
      display: 'flex', flexDirection: 'column',
      overflow: 'visible',
    }}>
      <div style={{
        padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8,
        borderBottom: '1px solid var(--hairline)',
        background: 'var(--bg-2)', borderRadius: '12px 12px 0 0',
      }}>
        <div style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--orange-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="sparkle" size={12} color="var(--orange)" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700 }}>Pagori 보안 에이전트</div>
          <div style={{ fontSize: 9, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
            컨텍스트: api/users/route.ts · v1 SQL Injection
          </div>
        </div>
        <button title="도크 (오른쪽 패널에 고정)" style={{ width: 22, height: 22, borderRadius: 5, border: 'none', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="panel" size={11} />
        </button>
        <button title="닫기" style={{ width: 22, height: 22, borderRadius: 5, border: 'none', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="x" size={11} />
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflow: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ width: 22, height: 22, borderRadius: 5, background: 'var(--orange-dim)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="sparkle" size={11} color="var(--orange)" />
          </div>
          <div>
            <div style={{ fontSize: 12, lineHeight: 1.6 }}>안녕하세요. 어떤 취약점에 대해 도와드릴까요?</div>
            <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <span className="chip chip-orange" style={{ cursor: 'pointer' }}>이 파일 분석</span>
              <span className="chip" style={{ cursor: 'pointer' }}>패치 보여줘</span>
              <span className="chip" style={{ cursor: 'pointer' }}>익스플로잇 시나리오</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexDirection: 'row-reverse' }}>
          <div style={{ width: 22, height: 22, borderRadius: 5, background: 'var(--bg-3)', flexShrink: 0 }} />
          <div style={{
            padding: '8px 12px', background: 'var(--bg-3)', borderRadius: 8,
            fontSize: 12, lineHeight: 1.55, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
          }}>
            <span className="chip chip-critical" style={{ height: 18, fontSize: 9 }}>
              <span className="severity-dot" style={{ background: 'var(--critical)' }} />v1 SQL Injection
            </span>
            은 어떻게 익스플로잇될 수 있어?
          </div>
        </div>
      </div>

      {/* Input with @mention dropdown */}
      <div style={{ padding: 10, borderTop: '1px solid var(--hairline)', position: 'relative' }}>
        {showMention && (
          <div style={{
            position: 'absolute', bottom: '100%', left: 10, right: 10, marginBottom: 4,
            background: 'var(--bg-2)', border: '1px solid var(--border-2)', borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
            maxHeight: 220, overflow: 'auto', zIndex: 5,
          }}>
            <div style={{ padding: '6px 12px', fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)', background: 'var(--bg-3)', borderBottom: '1px solid var(--hairline)' }}>
              @ 취약점 멘션 — 9개 중 3개
            </div>
            {MOCK_VULNS.slice(0, 4).map((v, i) => (
              <div key={v.id} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px',
                background: i === 0 ? 'var(--orange-dim)' : 'transparent',
                borderLeft: i === 0 ? '2px solid var(--orange-2)' : '2px solid transparent',
                cursor: 'pointer',
              }}>
                <span className="severity-dot" style={{ background: SEV_META[v.severity].color }} />
                <span className="mono" style={{ fontSize: 10, color: SEV_META[v.severity].color, fontWeight: 700, width: 22 }}>{v.id}</span>
                <span style={{ fontSize: 12, fontWeight: 500, flex: 1 }}>{v.type}</span>
                <span className="mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{v.file.split('/').pop()}:{v.line}</span>
              </div>
            ))}
            <div style={{
              padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 10, color: 'var(--text-tertiary)',
              borderTop: '1px solid var(--hairline)',
              background: 'var(--bg-3)',
            }}>
              <span>또는</span>
              <span style={{ display: 'flex', gap: 4 }}>
                <span className="chip" style={{ height: 16, fontSize: 8 }}>#CRITICAL</span>
                <span className="chip" style={{ height: 16, fontSize: 8 }}>#api/users</span>
              </span>
              <span>로 범위 지정</span>
            </div>
          </div>
        )}

        <div style={{
          display: 'flex', alignItems: 'flex-end', gap: 8,
          padding: '8px 10px', background: 'var(--bg-3)', borderRadius: 8,
          border: `1px solid ${showMention ? 'var(--orange-2)' : 'var(--border)'}`,
        }}>
          <div style={{ flex: 1, fontSize: 12, lineHeight: 1.5, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', minHeight: 18 }}>
            {showMention ? (
              <>
                <span className="chip chip-critical" style={{ height: 18, fontSize: 9, verticalAlign: '0' }}>
                  <span className="severity-dot" style={{ background: 'var(--critical)' }} />v1 SQL Injection
                </span>
                {' '}을 어떻게 패치하면 좋을까? <span style={{ color: 'var(--orange)', fontWeight: 700 }}>@</span>
                <span style={{ background: 'var(--orange-2)', display: 'inline-block', width: 7, height: 14, verticalAlign: '-2px', marginLeft: 1, animation: 'pulse-dot 0.8s infinite' }} />
              </>
            ) : (
              <span style={{ color: 'var(--text-tertiary)' }}>이 취약점에 대해 질문하세요…  <span style={{ fontSize: 10 }}>(@취약점, #태그)</span></span>
            )}
          </div>
          <button style={{
            width: 22, height: 22, borderRadius: 5,
            background: 'var(--orange-2)', color: '#fff', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}><Icon name="arrowRight" size={11} stroke={2.2} /></button>
        </div>
        <div style={{ marginTop: 6, fontSize: 9, color: 'var(--text-tertiary)', display: 'flex', justifyContent: 'space-between' }}>
          <span><span className="mono">@</span> 취약점 · <span className="mono">#</span> 태그/파일 · <span className="mono">⇧↵</span> 줄바꿈</span>
          <span>Haiku · 5크레딧</span>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// V4 Hybrid — Main editor with floating chat bubble (closed state)
// ═════════════════════════════════════════════════════════════════════
function EditorV4Hybrid({ width = 1440, height = 900, sidebarOpen = false, chatState = 'closed', mentionOpen = false, contextMenu = false, multiSelect = false }) {
  return (
    <WindowChrome width={width} height={height} title="Pagori · shop-api · main">
      <HybridHeader sidebarOpen={sidebarOpen} />

      {/* Progress strip */}
      <div style={{
        height: 28, flexShrink: 0,
        background: 'var(--bg-1)',
        borderBottom: '1px solid var(--hairline)',
        display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 10, fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)',
        }}>
          <span className="severity-dot" style={{ background: 'var(--orange)', animation: 'pulse-dot 1.4s infinite' }} />
          분석 중 · SAST 4/7
        </div>
        <div style={{ flex: 1, maxWidth: 320 }}>
          <div className="progress-track"><div className="progress-fill" style={{ width: '57%' }} /></div>
        </div>
        <span className="mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>현재: lib/auth.ts</span>
        <div style={{ flex: 1 }} />
        <span className="mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>12.4k tokens · $0.0234</span>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0, position: 'relative' }}>
        <HybridSidebar open={sidebarOpen} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <HybridCode />
          {/* slim DAST status strip */}
          <div style={{
            height: 26, flexShrink: 0,
            background: 'var(--bg-1)',
            borderTop: '1px solid var(--hairline)',
            display: 'flex', alignItems: 'center', gap: 12, padding: '0 14px',
            fontSize: 10, fontFamily: 'var(--font-mono)',
          }}>
            <Icon name="terminal" size={11} color="var(--orange)" />
            <span style={{ color: 'var(--text-secondary)' }}>DAST</span>
            <span className="chip chip-critical" style={{ height: 16, fontSize: 8 }}>1 EXPLOITED</span>
            <span className="chip chip-low" style={{ height: 16, fontSize: 8 }}>2 SAFE</span>
            <span className="chip" style={{ height: 16, fontSize: 8 }}>7 미실행</span>
            <div style={{ flex: 1 }} />
            <Icon name="chevronUp" size={11} color="var(--text-tertiary)" />
          </div>
        </div>

        {/* Right panel: ActivityRail (always visible) OR docked chat */}
        {chatState === 'docked' ? (
          <div style={{ width: 420, flexShrink: 0, background: 'var(--bg-1)', borderLeft: '1px solid var(--hairline)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--hairline)', background: 'var(--bg-2)' }}>
              <div style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--orange-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="sparkle" size={12} color="var(--orange)" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>AI 채팅 · 도크됨</div>
                <div style={{ fontSize: 9, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>v1 SQL Injection 컨텍스트</div>
              </div>
              <button title="플로팅 모드로" style={{ width: 22, height: 22, borderRadius: 5, border: 'none', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer' }}>
                <Icon name="externalLink" size={11} />
              </button>
              <button title="활동 패널 복귀" style={{ width: 22, height: 22, borderRadius: 5, border: 'none', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer' }}>
                <Icon name="x" size={11} />
              </button>
            </div>
            <ChatPanelDocked />
          </div>
        ) : (
          <ActivityRailV2
            selectedIds={multiSelect ? ['v1','v2','v3'] : []}
            showBulkBar={multiSelect}
            showContextMenu={contextMenu}
            contextMenuFor="v1"
          />
        )}

        {/* Floating chat bubble layers */}
        {chatState === 'closed' && <ChatBubble unread={1} />}
        {chatState === 'popup' && <ChatPopup showMention={mentionOpen} />}
      </div>
    </WindowChrome>
  );
}

// Docked chat panel — fuller version
function ChatPanelDocked() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--orange-dim)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="sparkle" size={12} color="var(--orange)" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4, fontFamily: 'var(--font-mono)' }}>Pagori · 12:43</div>
            <div style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 10 }}>
              <code style={{ background: 'var(--bg-3)', padding: '1px 5px', borderRadius: 3, fontSize: 11 }}>api/users/route.ts:42</code>의 SQL Injection은 다음과 같이 익스플로잇됩니다:
            </div>
            <div style={{ padding: 12, background: 'var(--bg-0)', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: 11, marginBottom: 10, lineHeight: 1.6 }}>
              <span style={{ color: 'var(--info)' }}>GET</span> /api/users?id=<span style={{ color: 'var(--critical)' }}>1' OR '1'='1</span>
              <br /><span style={{ color: 'var(--text-tertiary)' }}>→ WHERE 절이 항상 참 → 전체 테이블 노출</span>
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6 }}>
              <strong>해결책</strong>: parameterized query로 변경하면 입력이 데이터로 처리되어 안전합니다.
            </div>
            <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
              <button className="btn btn-sm" style={{ height: 22, background: 'var(--low-dim)', borderColor: 'rgba(34,197,94,0.30)', color: 'var(--low)' }}>
                <Icon name="zap" size={10} />패치 적용
              </button>
              <button className="btn btn-sm" style={{ height: 22 }}><Icon name="copy" size={10} />복사</button>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexDirection: 'row-reverse' }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--bg-3)', flexShrink: 0 }} />
          <div style={{ padding: '8px 12px', background: 'var(--bg-3)', borderRadius: 8, fontSize: 13, lineHeight: 1.55, maxWidth: '80%', display: 'inline-flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
            <span className="chip chip-critical" style={{ height: 18, fontSize: 9 }}>
              <span className="severity-dot" style={{ background: 'var(--critical)' }} />v2 Hardcoded Secret
            </span>
            도 비슷한 방식으로 패치할 수 있어?
          </div>
        </div>
      </div>

      <div style={{ padding: 12, borderTop: '1px solid var(--hairline)' }}>
        <div style={{
          display: 'flex', alignItems: 'flex-end', gap: 8,
          padding: '8px 10px', background: 'var(--bg-3)', borderRadius: 8,
          border: '1px solid var(--border)',
        }}>
          <span style={{ flex: 1, fontSize: 13, color: 'var(--text-tertiary)' }}>답변을 입력하세요…</span>
          <button style={{ width: 24, height: 24, borderRadius: 5, background: 'var(--orange-2)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Icon name="arrowRight" size={12} stroke={2.2} />
          </button>
        </div>
        <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-tertiary)' }}>
          <span className="mono">@</span> 취약점 · <span className="mono">#</span> 태그 · <span className="mono">⇧↵</span> 줄바꿈
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { EditorV4Hybrid });
