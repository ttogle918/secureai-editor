/* global React, Icon, Chip, WindowChrome, SEV_META, MOCK_VULNS,
   DashboardV1Analyst, DashboardV2Executive */
// DashboardCombined.jsx — unified dashboard with view toggle + date range +
// PDF download (which includes the analyst-style detail).

const { useState: useStateDC } = React;

// ─── Date range pill bar ────────────────────────────────────
function DateRangeBar({ value = '7d', onChange }) {
  const ranges = [
    { id: '24h', label: '24h' },
    { id: '7d', label: '7일' },
    { id: '30d', label: '30일' },
    { id: '90d', label: '90일' },
    { id: 'all', label: '전체' },
  ];
  return (
    <div style={{
      display: 'flex', height: 28, padding: 2,
      background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 7,
    }}>
      {ranges.map(r => (
        <button key={r.id} onClick={() => onChange?.(r.id)} style={{
          padding: '0 12px', borderRadius: 5, border: 'none',
          background: value === r.id ? 'var(--bg-1)' : 'transparent',
          color: value === r.id ? 'var(--text-primary)' : 'var(--text-tertiary)',
          fontSize: 11, fontWeight: 600, cursor: 'pointer',
          boxShadow: value === r.id ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
        }}>{r.label}</button>
      ))}
      <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--border)', margin: '0 4px' }} />
      <button style={{
        padding: '0 8px', borderRadius: 5, border: 'none', background: 'transparent',
        color: 'var(--text-tertiary)', fontSize: 11, fontWeight: 600, cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 4,
      }}>
        <Icon name="history" size={11} />사용자 지정
      </button>
    </div>
  );
}

// ─── View toggle (Summary / Detail) ─────────────────────────
function ViewToggle({ value = 'executive', onChange }) {
  return (
    <div style={{
      display: 'flex', height: 28, padding: 2,
      background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 7,
    }}>
      {[
        { id: 'executive', label: '요약 (Executive)', icon: 'pieChart' },
        { id: 'analyst', label: '상세 (Analyst)', icon: 'barChart' },
      ].map(v => (
        <button key={v.id} onClick={() => onChange?.(v.id)} style={{
          padding: '0 12px', borderRadius: 5, border: 'none',
          background: value === v.id ? 'var(--bg-1)' : 'transparent',
          color: value === v.id ? 'var(--text-primary)' : 'var(--text-tertiary)',
          fontSize: 11, fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
          boxShadow: value === v.id ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
        }}>
          <Icon name={v.icon} size={11} />
          {v.label}
        </button>
      ))}
    </div>
  );
}

// ─── Top bar that wraps either view ─────────────────────────
function DashboardTopBar({ view, onViewChange, dateRange, onDateChange }) {
  return (
    <div style={{
      height: 48, flexShrink: 0,
      background: 'var(--bg-1)',
      borderBottom: '1px solid var(--hairline)',
      display: 'flex', alignItems: 'center', padding: '0 24px', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <PagoriMark size={22} />
        <span style={{ fontSize: 13, fontWeight: 700 }}>Security Dashboard</span>
        <Icon name="chevronRight" size={11} color="var(--text-tertiary)" />
        <span className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>shop-api · main</span>
      </div>

      <div style={{ flex: 1 }} />

      <DateRangeBar value={dateRange} onChange={onDateChange} />
      <ViewToggle value={view} onChange={onViewChange} />

      <button className="btn btn-sm" title="PDF 리포트 — 상세(Analyst) 뷰 기준으로 분포·차트 모두 포함">
        <Icon name="download" size={11} />PDF 리포트
      </button>
      <button className="btn btn-sm btn-primary"><Icon name="refresh" size={11} />다시 분석</button>
    </div>
  );
}

// ─── PDF download tooltip — explains what's included ────────
function PdfHelperRow() {
  return (
    <div style={{
      padding: '10px 16px',
      background: 'var(--info-dim)',
      border: '1px solid rgba(86,156,214,0.25)',
      borderRadius: 8,
      display: 'flex', alignItems: 'center', gap: 12,
      fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5,
    }}>
      <Icon name="fileText" size={14} color="var(--info)" />
      <span><strong style={{ color: 'var(--text-primary)' }}>PDF 리포트</strong>는 항상 <strong>Analyst(상세) 뷰</strong>의 분포·히트맵·OWASP 매트릭스를 모두 포함합니다 — 현재 화면이 요약 뷰여도 동일합니다.</span>
      <div style={{ flex: 1 }} />
      <Icon name="x" size={11} color="var(--text-tertiary)" style={{ cursor: 'pointer' }} />
    </div>
  );
}

// ─── Multi-select bulk action bar ───────────────────────────
function BulkActionBarRow({ count, onClear }) {
  return (
    <div style={{
      position: 'sticky', bottom: 16, zIndex: 5,
      margin: '12px auto 0',
      maxWidth: 760, padding: '10px 14px',
      background: 'var(--bg-1)',
      border: '1px solid var(--orange)',
      borderRadius: 10,
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 6,
        background: 'var(--orange-2)', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)',
      }}>{count}</div>
      <span style={{ fontSize: 13, fontWeight: 600 }}>개 취약점 선택됨</span>
      <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
        <span className="mono">⌘A</span> 모두 · <span className="mono">⎋</span> 해제
      </span>
      <div style={{ flex: 1 }} />
      <button className="btn btn-sm" style={{ height: 26 }}><Icon name="zap" size={11} />패치 일괄 적용</button>
      <button className="btn btn-sm" style={{ height: 26 }}><Icon name="terminal" size={11} />DAST 실행</button>
      <button className="btn btn-sm" style={{ height: 26 }}><Icon name="sparkle" size={11} />AI 분석</button>
      <button className="btn btn-sm btn-ghost" style={{ height: 26, color: 'var(--text-tertiary)' }}><Icon name="xCircle" size={11} />무시</button>
      <button className="btn btn-sm btn-ghost" style={{ height: 26, color: 'var(--text-tertiary)' }}><Icon name="download" size={11} />내보내기</button>
      <button onClick={onClear} title="해제" className="btn btn-sm btn-ghost" style={{ height: 26, width: 26, padding: 0, justifyContent: 'center' }}><Icon name="x" size={12} /></button>
    </div>
  );
}

// ─── Selectable vuln row (for tables that support multi-select) ────
function SelectableVulnRow({ v, selected, showCheckbox }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '24px 24px 1.5fr 2fr 1fr 1fr auto',
      gap: 12, padding: '10px 0', alignItems: 'center',
      fontSize: 12, borderBottom: '1px solid var(--hairline)',
      background: selected ? 'var(--orange-dim)' : 'transparent',
      borderLeft: selected ? '2px solid var(--orange-2)' : '2px solid transparent',
      cursor: 'pointer',
    }}>
      {/* Checkbox — appears on hover or when any selected */}
      <span style={{
        marginLeft: 12,
        width: 14, height: 14, borderRadius: 3,
        border: `1.5px solid ${selected ? 'var(--orange-2)' : 'var(--border-3)'}`,
        background: selected ? 'var(--orange-2)' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: showCheckbox ? 1 : 0,
      }}>
        {selected && <Icon name="check" size={9} color="#fff" stroke={3} />}
      </span>
      <span className="severity-dot" style={{ background: SEV_META[v.severity].color, boxShadow: v.severity === 'critical' ? `0 0 6px ${SEV_META[v.severity].color}` : 'none' }} />
      <span style={{ fontWeight: 600 }}>{v.type}</span>
      <span className="mono" style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{v.file}:{v.line}</span>
      <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{v.cwe}</span>
      <span style={{ display: 'flex', gap: 4 }}>
        {v.tags.includes('DAST_EXPLOITED') && <span className="chip chip-critical" style={{ height: 18, fontSize: 8 }}>EXPLOITED</span>}
        {v.tags.includes('DAST_DONE') && !v.tags.includes('DAST_EXPLOITED') && <span className="chip chip-low" style={{ height: 18, fontSize: 8 }}>DAST SAFE</span>}
        {!v.tags.some(t => t.startsWith('DAST')) && <span className="chip" style={{ height: 18, fontSize: 8 }}>DAST 대기</span>}
      </span>
      <span className={`chip chip-${v.status === 'patched' ? 'low' : v.severity}`} style={{ height: 20, fontSize: 9, marginRight: 12 }}>
        {v.status === 'patched' ? 'PATCHED' : SEV_META[v.severity].label}
      </span>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// DashboardCombined — single source of truth with view toggle
// ═════════════════════════════════════════════════════════════════════
function DashboardCombined({ width = 1440, height = 900, view = 'executive', dateRange = '7d', multiSelect = false }) {
  // The executive view is the default; analyst view shows the full grid.
  // We re-use the existing V1/V2 components for the body content
  // and just swap the chrome (top bar + helpers).

  return (
    <WindowChrome width={width} height={height} title="Pagori · Dashboard · shop-api">
      <DashboardTopBar view={view} dateRange={dateRange} />

      <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg-0)', position: 'relative' }}>
        {/* Tiny helper banner */}
        <div style={{ padding: '12px 24px 0', maxWidth: 1320, margin: '0 auto' }}>
          <PdfHelperRow />
        </div>

        {/* The actual view */}
        <div style={{ padding: '4px 0 0' }}>
          {view === 'executive'
            ? <DashboardExecutiveBody multiSelect={multiSelect} dateRange={dateRange} />
            : <DashboardAnalystBody multiSelect={multiSelect} dateRange={dateRange} />}
        </div>
      </div>
    </WindowChrome>
  );
}

// ─── Inlined body for executive view (V2-style hero + key sections) ──
function DashboardExecutiveBody({ multiSelect, dateRange }) {
  // Re-use score ring + trend from the existing DashboardVariants — but
  // we'll build a smaller body that fits within the combined chrome.

  return (
    <div>
      <div style={{
        padding: '20px 32px',
        background: 'radial-gradient(circle at 30% 0%, var(--orange-dim) 0%, transparent 50%)',
      }}>
        <div style={{ maxWidth: 1320, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 32 }}>
          {/* Compact score badge */}
          <div style={{
            width: 140, height: 140, borderRadius: 14,
            background: 'var(--bg-1)', border: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            position: 'relative', flexShrink: 0,
          }}>
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>보안 점수</span>
            <span style={{ fontSize: 48, fontWeight: 700, color: 'var(--orange)', fontFamily: 'var(--font-mono)', lineHeight: 1, margin: '4px 0' }}>62</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--low)' }}>
              <Icon name="trend" size={10} />+7 (vs 어제)
            </div>
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>
              {dateRange === '24h' ? '지난 24시간' : dateRange === '7d' ? '지난 7일' : dateRange === '30d' ? '지난 30일' : '전체 기간'} · main · 5월 17일 분석
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.2, marginBottom: 10, letterSpacing: '-0.02em' }}>
              즉시 조치 필요한 취약점 <span style={{ color: 'var(--critical)' }}>2건</span>이 있습니다
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, maxWidth: 720 }}>
              SQL Injection과 하드코딩된 시크릿이 main 브랜치에 노출되어 있습니다.
              AI가 두 건 모두 자동 패치를 생성했으며, 적용 시 보안 점수는 <strong style={{ color: 'var(--low)' }}>89점</strong>까지 상승합니다.
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button className="btn btn-primary"><Icon name="zap" size={12} fill="currentColor" />추천 패치 검토</button>
              <button className="btn"><Icon name="externalLink" size={11} />취약점 목록</button>
            </div>
          </div>

          {/* Stat column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 180, flexShrink: 0 }}>
            {[
              { label: 'CRITICAL', count: 2, color: 'var(--critical)' },
              { label: 'HIGH', count: 3, color: 'var(--high)' },
              { label: 'MEDIUM', count: 3, color: 'var(--medium)' },
              { label: 'LOW', count: 2, color: 'var(--low)' },
            ].map(r => (
              <div key={r.label} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '6px 12px', borderRadius: 7,
                background: 'var(--bg-2)', border: '1px solid var(--border)',
              }}>
                <span className="severity-dot" style={{ background: r.color, boxShadow: r.label === 'CRITICAL' ? `0 0 6px ${r.color}` : 'none' }} />
                <span style={{ flex: 1, fontSize: 10, fontWeight: 700, color: r.color, letterSpacing: '0.05em', fontFamily: 'var(--font-mono)' }}>{r.label}</span>
                <span style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{r.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top 3 priorities + Trend (compact) */}
      <div style={{ padding: '0 32px 24px', maxWidth: 1320, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700 }}>조치 필요 우선순위</div>
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 8 }}>가장 위험한 3건</span>
            <div style={{ flex: 1 }} />
            <button className="btn btn-sm btn-ghost" style={{ height: 22 }}>전체 보기 <Icon name="arrowRight" size={10} stroke={2.2} /></button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {MOCK_VULNS.slice(0, 3).map((v, i) => (
              <div key={v.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: 10, borderRadius: 6,
                background: 'var(--bg-3)', border: '1px solid var(--border)',
                cursor: 'pointer',
              }}>
                <span style={{
                  width: 24, height: 24, borderRadius: 5,
                  background: SEV_META[v.severity].dim, color: SEV_META[v.severity].color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)',
                }}>{i+1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{v.type}</div>
                  <div className="mono" style={{ fontSize: 10, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.file}:{v.line}</div>
                </div>
                {v.tags.includes('DAST_EXPLOITED') && <span className="chip chip-critical" style={{ height: 18, fontSize: 8 }}>EXPLOITED</span>}
                <Icon name="arrowRight" size={12} color="var(--text-tertiary)" />
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700 }}>점수 트렌드</div>
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 8 }}>지난 8일</span>
            <div style={{ flex: 1 }} />
            <span className="chip chip-low">+21</span>
          </div>
          {/* mini sparkline */}
          <svg viewBox="0 0 360 110" style={{ width: '100%', height: 110 }}>
            <defs>
              <linearGradient id="grad-exec" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--orange)" stopOpacity="0.30" />
                <stop offset="100%" stopColor="var(--orange)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M0,70 L51,62 L102,58 L153,52 L204,40 L255,30 L306,42 L360,28 L360,110 L0,110 Z" fill="url(#grad-exec)" />
            <path d="M0,70 L51,62 L102,58 L153,52 L204,40 L255,30 L306,42 L360,28" fill="none" stroke="var(--orange)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            {[[0,70],[51,62],[102,58],[153,52],[204,40],[255,30],[306,42],[360,28]].map(([x,y],i)=>(
              <circle key={i} cx={x} cy={y} r="3" fill="var(--bg-1)" stroke="var(--orange)" strokeWidth="2" />
            ))}
          </svg>
        </div>
      </div>
    </div>
  );
}

// ─── Inlined body for analyst view (denser, with selectable rows) ────
function DashboardAnalystBody({ multiSelect, dateRange }) {
  const sel = multiSelect ? new Set(['v1','v2','v3']) : new Set();

  return (
    <div style={{ padding: '12px 24px 24px', maxWidth: 1320, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* KPI row — denser */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
        {[
          { label: '보안 점수', value: 62, color: 'var(--orange)' },
          { label: 'CRITICAL', value: 2, color: 'var(--critical)' },
          { label: 'HIGH', value: 3, color: 'var(--high)' },
          { label: 'MEDIUM', value: 3, color: 'var(--medium)' },
          { label: '패치 완료', value: '20%', color: 'var(--low)' },
        ].map((k, i) => (
          <div key={i} className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{k.label}</span>
            <span style={{ fontSize: 24, fontWeight: 700, color: k.color, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{k.value}</span>
          </div>
        ))}
      </div>

      {/* Three-column charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 12 }}>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 10 }}>보안 점수 트렌드</div>
          <svg viewBox="0 0 320 80" style={{ width: '100%', height: 80 }}>
            <defs>
              <linearGradient id="grad-a" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--orange)" stopOpacity="0.30" />
                <stop offset="100%" stopColor="var(--orange)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M0,50 L46,42 L92,38 L138,32 L184,22 L230,18 L276,28 L320,12 L320,80 L0,80 Z" fill="url(#grad-a)" />
            <path d="M0,50 L46,42 L92,38 L138,32 L184,22 L230,18 L276,28 L320,12" fill="none" stroke="var(--orange)" strokeWidth="2" />
          </svg>
        </div>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 10 }}>심각도별 분포</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[['critical',2],['high',3],['medium',3],['low',2]].map(([s,c]) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 60, fontSize: 9, fontWeight: 700, color: SEV_META[s].color, fontFamily: 'var(--font-mono)' }}>{SEV_META[s].label}</span>
                <div style={{ flex: 1, height: 6, background: 'var(--bg-3)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(c/3)*100}%`, background: SEV_META[s].color, borderRadius: 3 }} />
                </div>
                <span style={{ width: 18, textAlign: 'right', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{c}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 10 }}>DAST 검사 상태</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: 'EXPLOITED', count: 1, color: 'var(--critical)' },
              { label: 'DAST SAFE', count: 2, color: 'var(--low)' },
              { label: '미실행', count: 7, color: 'var(--text-tertiary)' },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="severity-dot" style={{ background: r.color }} />
                <span style={{ flex: 1, fontSize: 11, fontWeight: 600 }}>{r.label}</span>
                <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: r.color }}>{r.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Vuln table with multi-select */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--hairline)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700 }}>취약점 상세 목록</span>
          <span className="chip">{MOCK_VULNS.length}</span>
          <div style={{ flex: 1 }} />
          <Chip tone="critical" active>CRITICAL 2</Chip>
          <Chip tone="high" active>HIGH 3</Chip>
          <Chip tone="medium">MEDIUM 3</Chip>
          <Chip tone="low">LOW 2</Chip>
        </div>

        <div style={{ padding: 0 }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '24px 24px 1.5fr 2fr 1fr 1fr auto',
            gap: 12, padding: '8px 0',
            fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', fontFamily: 'var(--font-mono)',
            color: 'var(--text-tertiary)',
            borderBottom: '1px solid var(--hairline)',
            background: 'var(--bg-2)',
          }}>
            <span style={{ marginLeft: 12, width: 14, height: 14, borderRadius: 3, border: `1.5px solid ${multiSelect ? 'var(--orange-2)' : 'var(--border-3)'}`, background: multiSelect ? 'var(--orange-2)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: multiSelect ? 1 : 0.5 }}>
              {multiSelect && <Icon name="check" size={9} color="#fff" stroke={3} />}
            </span>
            <span></span>
            <span>유형</span>
            <span>파일</span>
            <span>CWE</span>
            <span>DAST</span>
            <span style={{ marginRight: 12 }}>심각도</span>
          </div>
          {MOCK_VULNS.slice(0, 6).map(v => (
            <SelectableVulnRow key={v.id} v={v} selected={sel.has(v.id)} showCheckbox={multiSelect} />
          ))}
        </div>
      </div>

      {multiSelect && <BulkActionBarRow count={3} />}
    </div>
  );
}

Object.assign(window, { DashboardCombined, BulkActionBarRow });
