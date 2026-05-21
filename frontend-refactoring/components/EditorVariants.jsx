/* global React, Icon, SeverityChip, Chip, WindowChrome, SEV_META, MOCK_VULNS, MOCK_FILES */
// EditorVariants.jsx — 3 redesign variants for the main editor screen.
// All render at 1440x900 inside <WindowChrome>.

const { useState: useStateEd } = React;

// ─── Shared editor atoms ────────────────────────────────────────

function EditorHeader({ variant = 'tabs', view = 'editor', onToggleView, breadcrumb = ['src','api','users','route.ts'] }) {
  return (
    <div style={{
      height: 48, flexShrink: 0,
      background: 'var(--bg-1)',
      borderBottom: '1px solid var(--hairline)',
      display: 'flex', alignItems: 'center',
      padding: '0 16px', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 24, height: 24, borderRadius: 6,
          background: 'linear-gradient(135deg, var(--orange) 0%, var(--orange-2) 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(234,88,12,0.4)',
        }}>
          <Icon name="shield" size={13} color="#fff" stroke={2.2} fill="#fff" />
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em' }}>Pagori</span>
      </div>

      <div style={{ width: 1, height: 18, background: 'var(--hairline)' }} />

      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
        {breadcrumb.map((b, i) => (
          <React.Fragment key={i}>
            {i > 0 && <Icon name="chevronRight" size={11} color="var(--text-tertiary)" />}
            <span style={{ color: i === breadcrumb.length - 1 ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{b}</span>
          </React.Fragment>
        ))}
      </div>

      <div style={{ flex: 1 }} />

      {/* Cmd+K search */}
      <button style={{
        display: 'flex', alignItems: 'center', gap: 8,
        height: 26, padding: '0 8px 0 10px',
        background: 'var(--bg-3)', border: '1px solid var(--border)',
        borderRadius: 6, color: 'var(--text-tertiary)',
        fontSize: 11, cursor: 'pointer',
        minWidth: 220,
      }}>
        <Icon name="search" size={12} />
        <span style={{ flex: 1, textAlign: 'left' }}>취약점, 파일, CVE 검색</span>
        <span className="mono" style={{
          padding: '2px 5px', borderRadius: 3,
          background: 'var(--bg-1)', border: '1px solid var(--border)',
          fontSize: 9, fontWeight: 600,
        }}>⌘K</span>
      </button>

      {/* View toggle — segmented control */}
      <div style={{
        display: 'flex', height: 26, padding: 2,
        background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 7,
      }}>
        {['editor','dashboard'].map((v) => (
          <button key={v}
            onClick={() => onToggleView?.(v)}
            style={{
              padding: '0 10px', borderRadius: 5, border: 'none',
              background: view === v ? 'var(--bg-1)' : 'transparent',
              color: view === v ? 'var(--text-primary)' : 'var(--text-tertiary)',
              fontSize: 11, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 5,
              boxShadow: view === v ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
            }}>
            <Icon name={v === 'editor' ? 'code' : 'layout'} size={12} />
            {v === 'editor' ? '에디터' : '대시보드'}
          </button>
        ))}
      </div>

      {/* Notification bell */}
      <button style={{
        position: 'relative',
        width: 28, height: 26, border: '1px solid var(--border)',
        borderRadius: 6, background: 'var(--bg-2)',
        color: 'var(--text-secondary)', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name="bell" size={13} />
        <span style={{
          position: 'absolute', top: -3, right: -3,
          minWidth: 14, height: 14, borderRadius: 7,
          background: 'var(--orange-2)', color: '#fff',
          fontSize: 9, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 3px',
          boxShadow: '0 0 0 2px var(--bg-1)',
        }}>2</span>
      </button>

      {/* Primary CTA */}
      <button className="btn btn-primary" style={{ height: 28 }}>
        <Icon name="play" size={11} fill="currentColor" />
        분석 시작
      </button>
    </div>
  );
}

function ProgressStrip({ done = 4, total = 7, current = 'lib/auth.ts' }) {
  return (
    <div style={{
      height: 28, flexShrink: 0,
      background: 'var(--bg-1)',
      borderBottom: '1px solid var(--hairline)',
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '0 16px',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 10, fontWeight: 600, fontFamily: 'var(--font-mono)',
        color: 'var(--text-secondary)',
      }}>
        <span className="severity-dot" style={{ background: 'var(--orange)', animation: 'pulse-dot 1.4s infinite' }} />
        분석 중 · SAST {done}/{total} 파일 완료
      </div>
      <div style={{ flex: 1, maxWidth: 320 }}>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${(done/total)*100}%` }} />
        </div>
      </div>
      <span className="mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>현재: {current}</span>
      <div style={{ flex: 1 }} />
      <button className="btn btn-sm btn-ghost" style={{ height: 20, color: 'var(--text-secondary)' }}>
        <Icon name="pause" size={10} />중단
      </button>
    </div>
  );
}

// ─── File tree ───────────────────────────────────────────────
function FileTreeNode({ node, depth = 0, selectedPath, vulnsByFile }) {
  const [open, setOpen] = useStateEd(node.open ?? false);
  const isFolder = node.type === 'folder';
  const isSelected = !isFolder && node.path === selectedPath;
  const fileVulns = !isFolder && vulnsByFile?.[node.path];

  return (
    <>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: `4px 8px 4px ${8 + depth * 12}px`,
        fontSize: 12, cursor: 'pointer',
        background: isSelected ? 'var(--orange-dim)' : 'transparent',
        borderLeft: isSelected ? '2px solid var(--orange-2)' : '2px solid transparent',
        color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
      }} onClick={() => isFolder && setOpen(!open)}>
        {isFolder ? (
          <>
            <Icon name={open ? 'chevronDown' : 'chevronRight'} size={11} color="var(--text-tertiary)" />
            <Icon name={open ? 'folderOpen' : 'folder'} size={13} color={open ? 'var(--orange)' : 'var(--text-secondary)'} fill={open ? 'var(--orange-dim)' : 'none'} />
          </>
        ) : (
          <>
            <span style={{ width: 11, display: 'inline-block' }} />
            <Icon name="file" size={12} color="var(--text-tertiary)" />
          </>
        )}
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.name}</span>
        {fileVulns > 0 && (
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
            background: 'var(--critical-dim)', color: 'var(--critical)',
            fontFamily: 'var(--font-mono)',
          }}>{fileVulns}</span>
        )}
      </div>
      {isFolder && open && node.children?.map((c, i) => (
        <FileTreeNode key={i} node={c} depth={depth + 1} selectedPath={selectedPath} vulnsByFile={vulnsByFile} />
      ))}
    </>
  );
}

function FileTree({ selectedPath = 'api/users/route.ts' }) {
  const vulnsByFile = MOCK_VULNS.reduce((acc, v) => {
    acc[v.file] = (acc[v.file] || 0) + 1;
    return acc;
  }, {});
  return (
    <div style={{ padding: '8px 0', fontFamily: 'var(--font-mono)' }}>
      {MOCK_FILES.map((n, i) => (
        <FileTreeNode key={i} node={n} selectedPath={selectedPath} vulnsByFile={vulnsByFile} />
      ))}
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────
function Sidebar({ width = 240, project = 'shop-api', compact }) {
  return (
    <div style={{
      width, flexShrink: 0,
      background: 'var(--bg-1)',
      borderRight: '1px solid var(--hairline)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid var(--hairline)' }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.08em', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>PROJECT</div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 10px', borderRadius: 6,
          background: 'var(--bg-3)', border: '1px solid var(--border)',
          cursor: 'pointer',
        }}>
          <Icon name="github" size={12} color="var(--text-secondary)" />
          <span style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>{project}</span>
          <span className="chip chip-orange" style={{ height: 18, fontSize: 8 }}>main</span>
          <Icon name="chevronDown" size={10} color="var(--text-tertiary)" />
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ padding: '12px 14px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' }}>FILES</span>
          <div style={{ display: 'flex', gap: 2 }}>
            <button style={{ width: 18, height: 18, border: 'none', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', borderRadius: 3 }}>
              <Icon name="plus" size={11} />
            </button>
            <button style={{ width: 18, height: 18, border: 'none', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', borderRadius: 3 }}>
              <Icon name="folderOpen" size={11} />
            </button>
          </div>
        </div>
        <FileTree />
      </div>

      {/* Bottom: workspace + user */}
      <div style={{ padding: '10px 12px', borderTop: '1px solid var(--hairline)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 26, height: 26, borderRadius: 5,
          background: 'linear-gradient(135deg, var(--tag-3), var(--tag-1))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, color: '#fff',
        }}>JM</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600 }}>김지민</div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Pro · 1,240 크레딧</div>
        </div>
        <Icon name="settings" size={14} color="var(--text-tertiary)" />
      </div>
    </div>
  );
}

// ─── Mock code editor ────────────────────────────────────────
function CodeEditor({ withDast = false, dastHeight = 160 }) {
  const lines = [
    { n: 38, code: <><span style={{ color: '#c586c0' }}>export async function</span> <span style={{ color: '#dcdcaa' }}>GET</span>(<span style={{ color: '#9cdcfe' }}>req</span>: <span style={{ color: '#4ec9b0' }}>Request</span>) {'{'}</> },
    { n: 39, code: <>  <span style={{ color: '#c586c0' }}>const</span> {'{'} <span style={{ color: '#9cdcfe' }}>searchParams</span> {'}'} = <span style={{ color: '#c586c0' }}>new</span> <span style={{ color: '#4ec9b0' }}>URL</span>(req.url);</> },
    { n: 40, code: <>  <span style={{ color: '#c586c0' }}>const</span> <span style={{ color: '#9cdcfe' }}>userId</span> = searchParams.<span style={{ color: '#dcdcaa' }}>get</span>(<span style={{ color: '#ce9178' }}>'id'</span>);</> },
    { n: 41, code: <>  <span style={{ color: '#6a9955', fontStyle: 'italic' }}>// 🔴 Critical: SQL injection via unsanitized userId</span> </>, vuln: 'critical' },
    { n: 42, code: <>  <span style={{ color: '#c586c0' }}>const</span> <span style={{ color: '#9cdcfe' }}>query</span> = <span style={{ color: '#ce9178' }}>`SELECT * FROM users WHERE id = </span><span style={{ color: '#ce9178', background: 'rgba(240,65,65,0.20)', borderBottom: '2px wavy var(--critical)' }}>${'${userId}'}</span><span style={{ color: '#ce9178' }}>`</span>;</>, vuln: 'critical' },
    { n: 43, code: <>  <span style={{ color: '#c586c0' }}>const</span> <span style={{ color: '#9cdcfe' }}>rows</span> = <span style={{ color: '#c586c0' }}>await</span> db.<span style={{ color: '#dcdcaa' }}>query</span>(query);</> },
    { n: 44, code: <>  <span style={{ color: '#c586c0' }}>return</span> <span style={{ color: '#4ec9b0' }}>Response</span>.<span style={{ color: '#dcdcaa' }}>json</span>(rows);</> },
    { n: 45, code: <>{'}'}</> },
    { n: 46, code: <></> },
    { n: 47, code: <><span style={{ color: '#c586c0' }}>export async function</span> <span style={{ color: '#dcdcaa' }}>POST</span>(<span style={{ color: '#9cdcfe' }}>req</span>: <span style={{ color: '#4ec9b0' }}>Request</span>) {'{'}</> },
    { n: 48, code: <>  <span style={{ color: '#c586c0' }}>const</span> <span style={{ color: '#9cdcfe' }}>body</span> = <span style={{ color: '#c586c0' }}>await</span> req.<span style={{ color: '#dcdcaa' }}>json</span>();</> },
    { n: 49, code: <>  <span style={{ color: '#c586c0' }}>if</span> (!body.email) <span style={{ color: '#c586c0' }}>return</span> <span style={{ color: '#4ec9b0' }}>Response</span>.<span style={{ color: '#dcdcaa' }}>json</span>({'{'} error: <span style={{ color: '#ce9178' }}>'missing'</span> {'}'});</> },
    { n: 50, code: <>  <span style={{ color: '#c586c0' }}>const</span> <span style={{ color: '#9cdcfe' }}>user</span> = <span style={{ color: '#c586c0' }}>await</span> db.users.<span style={{ color: '#dcdcaa' }}>create</span>({'{ data: body '}{'}'});</> },
    { n: 51, code: <>  <span style={{ color: '#c586c0' }}>return</span> <span style={{ color: '#4ec9b0' }}>Response</span>.<span style={{ color: '#dcdcaa' }}>json</span>(user);</> },
    { n: 52, code: <>{'}'}</> },
  ];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Tabs */}
      <div style={{
        height: 34, flexShrink: 0, background: 'var(--bg-1)',
        borderBottom: '1px solid var(--hairline)',
        display: 'flex', alignItems: 'stretch',
      }}>
        {[
          { name: 'route.ts', path: 'api/users/route.ts', active: true, vuln: 'critical' },
          { name: 'comment.tsx', path: 'components/comment.tsx', vuln: 'high' },
          { name: 'config.ts', path: 'lib/config.ts', vuln: 'critical' },
        ].map((t) => (
          <div key={t.path} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '0 14px',
            background: t.active ? 'var(--bg-0)' : 'transparent',
            borderRight: '1px solid var(--hairline)',
            borderTop: t.active ? '1.5px solid var(--orange-2)' : '1.5px solid transparent',
            fontSize: 12, fontFamily: 'var(--font-mono)',
            color: t.active ? 'var(--text-primary)' : 'var(--text-secondary)',
            cursor: 'pointer',
          }}>
            <span className="severity-dot" style={{ background: SEV_META[t.vuln].color }} />
            {t.name}
            <Icon name="x" size={11} color="var(--text-tertiary)" />
          </div>
        ))}
      </div>

      {/* Code */}
      <div style={{
        flex: 1, minHeight: 0, overflow: 'auto',
        background: 'var(--bg-0)',
        fontFamily: 'var(--font-mono)', fontSize: 12.5,
        lineHeight: '20px',
        padding: '12px 0',
      }}>
        {lines.map((l, i) => (
          <div key={i} style={{
            display: 'flex', minWidth: 'max-content',
            background: l.vuln ? `var(--${l.vuln}-dim)` : 'transparent',
          }}>
            <span style={{
              width: 44, textAlign: 'right', paddingRight: 12,
              color: l.vuln ? SEV_META[l.vuln].color : 'var(--text-tertiary)',
              userSelect: 'none', flexShrink: 0,
            }}>{l.n}</span>
            {l.vuln && (
              <span style={{
                width: 10, marginRight: 8, alignSelf: 'center',
                height: 8, borderRadius: '50%',
                background: SEV_META[l.vuln].color,
                boxShadow: `0 0 6px ${SEV_META[l.vuln].color}`,
              }} />
            )}
            {!l.vuln && <span style={{ width: 18 }} />}
            <span style={{ color: 'var(--text-primary)' }}>{l.code}</span>
          </div>
        ))}
      </div>

      {/* DAST terminal */}
      {withDast && (
        <div style={{
          height: dastHeight, flexShrink: 0,
          background: 'var(--bg-1)',
          borderTop: '1px solid var(--hairline)',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            height: 28, padding: '0 12px', display: 'flex', alignItems: 'center', gap: 8,
            borderBottom: '1px solid var(--hairline)',
          }}>
            <Icon name="terminal" size={11} color="var(--orange)" />
            <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>DAST · /api/users?id=' OR '1'='1</span>
            <span className="chip chip-critical" style={{ height: 16, fontSize: 8 }}>EXPLOITED</span>
            <div style={{ flex: 1 }} />
            <Icon name="x" size={11} color="var(--text-tertiary)" style={{ cursor: 'pointer' }} />
          </div>
          <div style={{ flex: 1, padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)', overflow: 'auto' }}>
            <div><span style={{ color: 'var(--text-tertiary)' }}>[12:42:11]</span> <span style={{ color: 'var(--info)' }}>POST</span> /api/users?id=1' OR '1'='1</div>
            <div><span style={{ color: 'var(--text-tertiary)' }}>[12:42:12]</span> response: 200 · returned 1,245 rows</div>
            <div><span style={{ color: 'var(--text-tertiary)' }}>[12:42:12]</span> <span style={{ color: 'var(--critical)' }}>✕ EXPLOIT CONFIRMED</span> — SQL injection successful</div>
            <div><span style={{ color: 'var(--text-tertiary)' }}>[12:42:13]</span> evidence: 1,245 rows returned for non-existent user id</div>
            <div><span style={{ color: 'var(--text-tertiary)' }}>[12:42:13]</span> CVSS: 9.8 (Critical)</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Right panel pieces ──────────────────────────────────────
function VulnListItem({ v, selected, onClick, compact }) {
  const dastTag = v.tags.find(t => t.startsWith('DAST'));
  return (
    <div onClick={onClick} style={{
      padding: compact ? '8px 12px' : '10px 14px',
      borderBottom: '1px solid var(--hairline)',
      borderLeft: `2px solid ${selected ? SEV_META[v.severity].color : 'transparent'}`,
      background: selected ? 'var(--surface-hover)' : 'transparent',
      cursor: 'pointer',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
        <span className="severity-dot" style={{ background: SEV_META[v.severity].color, boxShadow: v.severity === 'critical' ? `0 0 6px ${SEV_META[v.severity].color}` : 'none' }} />
        <span style={{ fontSize: 12, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.type}</span>
        {v.status === 'patched' && <span className="chip chip-low" style={{ height: 16, fontSize: 8 }}>PATCHED</span>}
        {dastTag === 'DAST_EXPLOITED' && <span className="chip chip-critical" style={{ height: 16, fontSize: 8 }}>EXPLOITED</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{v.file}:{v.line}</span>
        <span>{v.cwe}</span>
      </div>
    </div>
  );
}

function VulnFilterBar({ active = 'all', counts }) {
  const filters = [
    { id:'all', label:'전체', count: counts.all },
    { id:'critical', label:'CRITICAL', count: counts.critical, tone:'critical' },
    { id:'high', label:'HIGH', count: counts.high, tone:'high' },
    { id:'medium', label:'MEDIUM', count: counts.medium, tone:'medium' },
    { id:'low', label:'LOW', count: counts.low, tone:'low' },
  ];
  return (
    <div style={{ padding: '8px 12px 8px', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {filters.map((f) => (
        <Chip key={f.id} tone={f.tone || 'default'} active={active === f.id}>
          {f.label} <span style={{ opacity: 0.7 }}>{f.count}</span>
        </Chip>
      ))}
    </div>
  );
}

function VulnDetail({ v }) {
  return (
    <div style={{ padding: '14px 16px', borderTop: '1px solid var(--hairline)', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span className="chip chip-critical" style={{ height: 22, fontSize: 10 }}>
            <span className="severity-dot" style={{ background: SEV_META[v.severity].color, boxShadow: `0 0 6px ${SEV_META[v.severity].color}` }} />
            {SEV_META[v.severity].label}
          </span>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{v.type}</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{v.desc}</div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <span className="chip">{v.cwe}</span>
        <span className="chip">{v.owasp}</span>
        {v.tags.map(t => <span key={t} className="chip" style={{ color: 'var(--tag-1)', borderColor: 'rgba(129,140,248,0.4)' }}>{t}</span>)}
      </div>

      {/* Call chain mini */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em', marginBottom: 8 }}>호출 체인</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontFamily: 'var(--font-mono)', fontSize: 10 }}>
          {[
            { layer: 'Frontend', name: 'UserPage.tsx', color: 'var(--layer-frontend)' },
            { layer: 'API', name: 'route.ts:42', color: 'var(--layer-controller)', glow: true },
            { layer: 'Service', name: 'db.query()', color: 'var(--layer-service)' },
            { layer: 'DB', name: 'users.*', color: 'var(--layer-repository)' },
          ].map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, boxShadow: s.glow ? `0 0 8px ${s.color}` : 'none' }} />
              <span style={{ width: 64, color: 'var(--text-tertiary)' }}>{s.layer}</span>
              <span style={{ color: 'var(--text-secondary)' }}>{s.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* AI patch suggestion */}
      <div style={{
        border: '1px solid rgba(34,197,94,0.30)',
        borderRadius: 8, overflow: 'hidden',
        background: 'rgba(34,197,94,0.04)',
      }}>
        <div style={{
          padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6,
          borderBottom: '1px solid rgba(34,197,94,0.20)',
        }}>
          <Icon name="sparkle" size={11} color="var(--low)" />
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--low)' }}>AI 패치 제안</span>
          <div style={{ flex: 1 }} />
          <button className="btn btn-sm" style={{ height: 20, background: 'var(--low)', borderColor: 'var(--low)', color: '#0a2810', fontWeight: 700 }}>
            <Icon name="check" size={10} stroke={2.4} />적용
          </button>
        </div>
        <div style={{ padding: 10, fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.5, background: 'var(--bg-0)' }}>
          <div style={{ color: 'var(--critical)' }}>- const query = `SELECT * FROM users WHERE id = ${'${userId}'}`</div>
          <div style={{ color: 'var(--low)' }}>+ const query = 'SELECT * FROM users WHERE id = $1'</div>
          <div style={{ color: 'var(--low)' }}>+ const rows = await db.query(query, [userId])</div>
        </div>
      </div>
    </div>
  );
}

function VulnPanel({ compact = false, height = '100%' }) {
  const counts = {
    all: MOCK_VULNS.length,
    critical: MOCK_VULNS.filter(v => v.severity === 'critical').length,
    high: MOCK_VULNS.filter(v => v.severity === 'high').length,
    medium: MOCK_VULNS.filter(v => v.severity === 'medium').length,
    low: MOCK_VULNS.filter(v => v.severity === 'low').length,
  };
  return (
    <div style={{ height, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <VulnFilterBar counts={counts} active="all" />
      <div style={{ overflow: 'auto', flex: '0 0 auto', maxHeight: compact ? 220 : 'none' }}>
        {MOCK_VULNS.slice(0, compact ? 4 : 6).map(v => (
          <VulnListItem key={v.id} v={v} selected={v.id === 'v1'} compact={compact} />
        ))}
      </div>
      <VulnDetail v={MOCK_VULNS[0]} />
    </div>
  );
}

function ChatPanel({ height = '100%' }) {
  return (
    <div style={{ height, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ flex: 1, overflow: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ width: 22, height: 22, borderRadius: 5, background: 'var(--orange-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="sparkle" size={11} color="var(--orange)" />
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 3, fontFamily: 'var(--font-mono)' }}>Pagori 보안 에이전트</div>
            <div style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text-primary)' }}>
              <code>api/users/route.ts:42</code>에서 발견된 SQL Injection은 parameterized query로 즉시 수정 가능합니다. <strong>위 패치 제안을 적용</strong>하시면 됩니다.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexDirection: 'row-reverse' }}>
          <div style={{ width: 22, height: 22, borderRadius: 5, background: 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="user" size={11} color="var(--text-secondary)" />
          </div>
          <div style={{
            padding: '8px 12px', borderRadius: 8, background: 'var(--bg-3)',
            fontSize: 12, lineHeight: 1.55, maxWidth: '80%',
          }}>이 취약점이 어떻게 익스플로잇될 수 있는지 보여줘.</div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ width: 22, height: 22, borderRadius: 5, background: 'var(--orange-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="sparkle" size={11} color="var(--orange)" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 3, fontFamily: 'var(--font-mono)' }}>Pagori · 생성 중</div>
            <div style={{ fontSize: 12, lineHeight: 1.6, marginBottom: 8 }}>
              공격자가 다음 페이로드를 보내면 <code>WHERE</code> 절이 항상 참이 되어 전체 사용자 테이블이 노출됩니다:
            </div>
            <div style={{ padding: 10, background: 'var(--bg-0)', borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--critical)' }}>
              GET /api/users?id=1' OR '1'='1
            </div>
            <div style={{ display: 'inline-block', width: 8, height: 12, background: 'var(--orange)', marginTop: 4, animation: 'pulse-dot 0.8s infinite' }} />
          </div>
        </div>
      </div>

      <div style={{ padding: 12, borderTop: '1px solid var(--hairline)' }}>
        <div style={{
          display: 'flex', alignItems: 'flex-end', gap: 8,
          padding: '8px 10px', background: 'var(--bg-3)', borderRadius: 8,
          border: '1px solid var(--border)',
        }}>
          <textarea
            placeholder="이 취약점에 대해 질문하세요…"
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              resize: 'none', fontSize: 12, lineHeight: 1.5, color: 'var(--text-primary)',
              fontFamily: 'var(--font-sans)', minHeight: 18, maxHeight: 60,
            }}
            rows={1}
          />
          <button style={{
            width: 22, height: 22, borderRadius: 5,
            background: 'var(--orange-2)', color: '#fff', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}><Icon name="arrowRight" size={11} stroke={2.2} /></button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 10, color: 'var(--text-tertiary)' }}>
          <span className="chip" style={{ height: 18 }}>Haiku · 5 크레딧</span>
          <span>·</span>
          <span>이 파일 컨텍스트로 답변</span>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// VARIANT 1 — REFINED TABS
// Current 3-panel layout, but with fixes:
//   - Segmented Editor/Dashboard toggle (not button toggle)
//   - Persistent progress strip when analyzing
//   - Right panel tabs improved (filter chips, severity tags clearer)
//   - DAST as collapsible bottom (closed by default — opens on attack run)
// ═════════════════════════════════════════════════════════════════════
function EditorV1Refined({ width = 1440, height = 900 }) {
  return (
    <WindowChrome width={width} height={height} title="Pagori · shop-api · main">
      <EditorHeader variant="tabs" view="editor" />
      <ProgressStrip done={4} total={7} current="lib/auth.ts" />
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <Sidebar width={236} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <CodeEditor withDast={true} dastHeight={150} />
        </div>
        <div style={{
          width: 360, flexShrink: 0,
          background: 'var(--bg-1)',
          borderLeft: '1px solid var(--hairline)',
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Right panel: tabs */}
          <div style={{
            height: 36, display: 'flex',
            borderBottom: '1px solid var(--hairline)',
            background: 'var(--bg-1)',
          }}>
            {[
              { id:'vulns', label: `취약점 ${MOCK_VULNS.length}`, icon: 'shieldAlert', active: true },
              { id:'chat', label: 'AI 채팅', icon: 'message' },
              { id:'progress', label: '진행률', icon: 'check' },
            ].map(t => (
              <div key={t.id} style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                fontSize: 11, fontWeight: 600,
                color: t.active ? 'var(--text-primary)' : 'var(--text-tertiary)',
                borderBottom: t.active ? '2px solid var(--orange-2)' : '2px solid transparent',
                cursor: 'pointer',
              }}>
                <Icon name={t.icon} size={12} />
                {t.label}
              </div>
            ))}
          </div>
          <VulnPanel />
        </div>
      </div>
    </WindowChrome>
  );
}

// ═════════════════════════════════════════════════════════════════════
// VARIANT 2 — SPLIT WORKSPACE
// Right panel split horizontally: Vulnerabilities (top) + Chat (bottom).
// Both visible simultaneously. DAST as overlay drawer.
// ═════════════════════════════════════════════════════════════════════
function EditorV2Split({ width = 1440, height = 900 }) {
  return (
    <WindowChrome width={width} height={height} title="Pagori · shop-api · main">
      <EditorHeader view="editor" />
      <ProgressStrip done={4} total={7} current="lib/auth.ts" />
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <Sidebar width={236} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <CodeEditor withDast={false} />
        </div>

        {/* Split right panel */}
        <div style={{
          width: 380, flexShrink: 0,
          background: 'var(--bg-1)',
          borderLeft: '1px solid var(--hairline)',
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Vuln top section */}
          <div style={{ flex: '0 0 50%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{
              padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8,
              borderBottom: '1px solid var(--hairline)',
            }}>
              <Icon name="shieldAlert" size={13} color="var(--orange)" />
              <span style={{ fontSize: 12, fontWeight: 700 }}>취약점</span>
              <span className="chip chip-critical" style={{ height: 18, fontSize: 9 }}>{MOCK_VULNS.length}</span>
              <div style={{ flex: 1 }} />
              <Icon name="filter" size={12} color="var(--text-tertiary)" />
              <Icon name="chevronDown" size={12} color="var(--text-tertiary)" />
            </div>
            <VulnPanel compact />
          </div>

          {/* Divider with drag */}
          <div style={{
            height: 6, background: 'var(--bg-0)',
            borderTop: '1px solid var(--hairline)',
            borderBottom: '1px solid var(--hairline)',
            cursor: 'ns-resize',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ width: 28, height: 2, background: 'var(--border-2)', borderRadius: 1 }} />
          </div>

          {/* Chat bottom section */}
          <div style={{ flex: '1 1 0%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{
              padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8,
              borderBottom: '1px solid var(--hairline)',
            }}>
              <Icon name="message" size={13} color="var(--tag-1)" />
              <span style={{ fontSize: 12, fontWeight: 700 }}>AI 채팅</span>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>v1 컨텍스트 활성</span>
              <div style={{ flex: 1 }} />
              <Icon name="refresh" size={11} color="var(--text-tertiary)" />
            </div>
            <ChatPanel />
          </div>
        </div>
      </div>
    </WindowChrome>
  );
}

// ═════════════════════════════════════════════════════════════════════
// VARIANT 3 — FOCUS MODE
// Collapsed slim sidebar (icons only). Big editor. Right "Activity Rail"
// shows severity dots; expanding any opens a drawer with details inline.
// ═════════════════════════════════════════════════════════════════════
function SlimSidebar() {
  return (
    <div style={{
      width: 52, flexShrink: 0, background: 'var(--bg-1)',
      borderRight: '1px solid var(--hairline)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '12px 0', gap: 4,
    }}>
      {[
        { icon: 'folder', active: true, badge: 8 },
        { icon: 'shieldAlert', badge: 10 },
        { icon: 'package' },
        { icon: 'history' },
        { icon: 'users' },
        { icon: 'settings' },
      ].map((b, i) => (
        <button key={i} style={{
          position: 'relative',
          width: 36, height: 36, borderRadius: 8,
          background: b.active ? 'var(--orange-dim)' : 'transparent',
          color: b.active ? 'var(--orange)' : 'var(--text-tertiary)',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name={b.icon} size={16} />
          {b.badge && (
            <span style={{
              position: 'absolute', top: 3, right: 3,
              minWidth: 13, height: 13, borderRadius: 7,
              background: 'var(--critical)', color: '#fff',
              fontSize: 8, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 3px',
            }}>{b.badge}</span>
          )}
        </button>
      ))}
      <div style={{ flex: 1 }} />
      <div style={{
        width: 30, height: 30, borderRadius: 8,
        background: 'linear-gradient(135deg, var(--tag-3), var(--tag-1))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700, color: '#fff',
      }}>JM</div>
    </div>
  );
}

function ActivityRail() {
  return (
    <div style={{
      width: 320, flexShrink: 0,
      background: 'var(--bg-1)',
      borderLeft: '1px solid var(--hairline)',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8,
        borderBottom: '1px solid var(--hairline)',
      }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>활동</span>
        <span className="chip chip-critical" style={{ height: 18, fontSize: 9 }}>{MOCK_VULNS.length} 활성</span>
        <div style={{ flex: 1 }} />
        <button style={{ width: 22, height: 22, borderRadius: 5, border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <Icon name="filter" size={11} />
        </button>
      </div>

      {/* Group by severity, accordion-style */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {[
          { sev:'critical', label:'Critical', open: true, items: MOCK_VULNS.filter(v=>v.severity==='critical') },
          { sev:'high', label:'High', open: true, items: MOCK_VULNS.filter(v=>v.severity==='high') },
          { sev:'medium', label:'Medium', open: false, items: MOCK_VULNS.filter(v=>v.severity==='medium') },
          { sev:'low', label:'Low', open: false, items: MOCK_VULNS.filter(v=>v.severity==='low') },
        ].map((g, gi) => (
          <div key={gi}>
            <div style={{
              padding: '10px 14px',
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'var(--bg-2)',
              borderBottom: '1px solid var(--hairline)',
              cursor: 'pointer',
            }}>
              <Icon name={g.open ? 'chevronDown' : 'chevronRight'} size={11} color="var(--text-tertiary)" />
              <span className="severity-dot" style={{ background: SEV_META[g.sev].color, boxShadow: g.sev === 'critical' ? `0 0 6px ${SEV_META[g.sev].color}` : 'none' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: SEV_META[g.sev].color, letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>{g.label.toUpperCase()}</span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>· {g.items.length}건</span>
            </div>
            {g.open && g.items.map(v => (
              <div key={v.id} style={{
                padding: '10px 14px 10px 32px',
                borderBottom: '1px solid var(--hairline)',
                background: v.id === 'v1' ? 'var(--surface-hover)' : 'transparent',
                borderLeft: v.id === 'v1' ? `2px solid ${SEV_META[v.severity].color}` : '2px solid transparent',
                cursor: 'pointer',
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{v.type}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.file}:{v.line}</span>
                  <span>{v.cwe}</span>
                </div>
                <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                  {v.tags.slice(0, 2).map(t => (
                    <span key={t} className="chip" style={{ height: 16, fontSize: 8, padding: '0 5px' }}>{t}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Floating AI bar */}
      <div style={{
        margin: 12, padding: '8px 10px',
        background: 'linear-gradient(135deg, var(--orange-dim), rgba(129,140,248,0.10))',
        border: '1px solid rgba(249,115,22,0.30)',
        borderRadius: 8,
        display: 'flex', alignItems: 'center', gap: 8,
        cursor: 'pointer',
      }}>
        <Icon name="sparkle" size={13} color="var(--orange)" />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700 }}>AI 에이전트에게 질문</div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>이 파일의 취약점 컨텍스트 활성</div>
        </div>
        <Icon name="chevronUp" size={12} color="var(--text-secondary)" />
      </div>
    </div>
  );
}

function EditorV3Focus({ width = 1440, height = 900 }) {
  return (
    <WindowChrome width={width} height={height} title="Pagori · shop-api · main">
      <EditorHeader view="editor" />
      <ProgressStrip done={4} total={7} current="lib/auth.ts" />
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <SlimSidebar />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <CodeEditor withDast={false} />
          {/* Inline mini-DAST status strip */}
          <div style={{
            height: 26, flexShrink: 0,
            background: 'var(--bg-1)',
            borderTop: '1px solid var(--hairline)',
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '0 14px',
            fontSize: 10, fontFamily: 'var(--font-mono)',
          }}>
            <Icon name="terminal" size={11} color="var(--orange)" />
            <span style={{ color: 'var(--text-secondary)' }}>DAST 준비</span>
            <span className="chip chip-critical" style={{ height: 16, fontSize: 8 }}>1 EXPLOITED</span>
            <span className="chip chip-low" style={{ height: 16, fontSize: 8 }}>2 SAFE</span>
            <div style={{ flex: 1 }} />
            <span style={{ color: 'var(--text-tertiary)' }}>SAST 4/7 · 12.4k tokens · $0.0234</span>
            <Icon name="chevronUp" size={11} color="var(--text-tertiary)" style={{ cursor: 'pointer' }} />
          </div>
        </div>
        <ActivityRail />
      </div>
    </WindowChrome>
  );
}

Object.assign(window, { EditorV1Refined, EditorV2Split, EditorV3Focus });
