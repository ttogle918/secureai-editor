/* global React, Icon, Chip, WindowChrome, SEV_META */
// SbomCve.jsx — SBOM & CVE results screen.
// Refactored for cleaner separation & breathing room:
//   • Each major section in its own card with generous padding
//   • Lighter table rows (no zebra, just hairline dividers, taller rows)
//   • KPIs presented as a single horizontal strip — less boxy
//   • CVE detail card moved into its own clearly-separated section

const MOCK_DEPS = [
  { name:'next', version:'15.0.3', latest:'15.0.5', ecosystem:'npm', cves:[], license:'MIT', direct: true },
  { name:'next-auth', version:'4.22.1', latest:'4.24.10', ecosystem:'npm', cves:[
    { id:'CVE-2024-22020', severity:'high', cvss:7.5, summary:'서버 사이드 요청 위조로 인한 정보 노출', fixed:'4.24.5' },
  ], license:'ISC', direct: true },
  { name:'axios', version:'1.6.2', latest:'1.7.7', ecosystem:'npm', cves:[
    { id:'CVE-2023-45857', severity:'medium', cvss:6.5, summary:'CSRF 토큰 헤더 노출', fixed:'1.6.4' },
  ], license:'MIT', direct: true },
  { name:'jsonwebtoken', version:'9.0.0', latest:'9.0.2', ecosystem:'npm', cves:[
    { id:'CVE-2022-23529', severity:'critical', cvss:9.8, summary:'JWT 검증 우회 취약점', fixed:'9.0.0' },
    { id:'CVE-2022-23541', severity:'high', cvss:7.6, summary:'알고리즘 혼동 공격', fixed:'9.0.0' },
  ], license:'MIT', direct: true },
  { name:'lodash', version:'4.17.20', latest:'4.17.21', ecosystem:'npm', cves:[
    { id:'CVE-2021-23337', severity:'high', cvss:7.2, summary:'명령어 인젝션 (template)', fixed:'4.17.21' },
  ], license:'MIT' },
  { name:'react', version:'18.3.1', latest:'18.3.1', ecosystem:'npm', cves:[], license:'MIT', direct: true },
  { name:'prisma', version:'5.22.0', latest:'6.0.1', ecosystem:'npm', cves:[], license:'Apache-2.0', direct: true },
  { name:'zod', version:'3.22.4', latest:'3.23.8', ecosystem:'npm', cves:[], license:'MIT' },
  { name:'pg', version:'8.11.3', latest:'8.13.1', ecosystem:'npm', cves:[], license:'MIT' },
  { name:'recharts', version:'2.10.4', latest:'2.13.3', ecosystem:'npm', cves:[], license:'MIT' },
];

// ─── Stat — single line metric in a horizontal strip ─────────
function Stat({ label, value, color = 'var(--text-primary)', sub, divider }) {
  return (
    <>
      <div style={{ flex: 1, padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 500, letterSpacing: '0.02em' }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span className="mono" style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1 }}>{value}</span>
          {sub && <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{sub}</span>}
        </div>
      </div>
      {divider && <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--hairline)', margin: '12px 0' }} />}
    </>
  );
}

// ─── Section block — clear separation pattern ────────────────
function Section({ title, subtitle, action, children, divider }) {
  return (
    <section>
      <div style={{ marginBottom: 14, display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em' }}>{title}</h3>
          {subtitle && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>{subtitle}</div>}
        </div>
        <div style={{ flex: 1 }} />
        {action}
      </div>
      {children}
    </section>
  );
}

function SbomCve({ width = 1440, height = 900 }) {
  const totalDeps = MOCK_DEPS.length;
  const vulnDeps = MOCK_DEPS.filter(d => d.cves.length > 0).length;
  const totalCves = MOCK_DEPS.reduce((acc, d) => acc + d.cves.length, 0);
  const criticalCves = MOCK_DEPS.flatMap(d => d.cves).filter(c => c.severity === 'critical').length;
  const outdated = MOCK_DEPS.filter(d => d.version !== d.latest).length;

  return (
    <WindowChrome width={width} height={height} title="Pagori · SBOM & CVE · shop-api">
      {/* Header */}
      <div style={{
        height: 48, flexShrink: 0,
        background: 'var(--bg-1)',
        borderBottom: '1px solid var(--hairline)',
        display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PagoriMark size={20} />
          <div style={{ width: 1, height: 16, background: 'var(--hairline)' }} />
          <div style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--tag-1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="package" size={13} color="#fff" stroke={2.2} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 700 }}>SBOM & CVE</span>
          <Icon name="chevronRight" size={11} color="var(--text-tertiary)" />
          <span className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>shop-api · package.json</span>
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn btn-sm"><Icon name="download" size={11} />SBOM 내보내기 (SPDX)</button>
        <button className="btn btn-sm btn-primary"><Icon name="refresh" size={11} />재스캔</button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg-0)' }}>
        <div style={{ padding: '32px 32px 48px', maxWidth: 1280, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 32 }}>

          {/* ─── KPI strip — single card, divided sections ─── */}
          <div className="card" style={{ display: 'flex', padding: 0 }}>
            <Stat label="총 의존성" value={totalDeps} divider />
            <Stat label="취약한 의존성" value={vulnDeps} color="var(--critical)" sub={`(${Math.round(vulnDeps/totalDeps*100)}%)`} divider />
            <Stat label="전체 CVE" value={totalCves} color="var(--high)" divider />
            <Stat label="CRITICAL" value={criticalCves} color="var(--critical)" divider />
            <Stat label="업데이트 가능" value={outdated} color="var(--orange)" />
          </div>

          {/* ─── Filter section ─── */}
          <Section
            title="의존성 필터"
            subtitle="심각도 · 의존성 종류 · 생태계로 좁히기"
            action={
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px',
                height: 30, background: 'var(--bg-2)', border: '1px solid var(--border)',
                borderRadius: 7, minWidth: 280,
              }}>
                <Icon name="search" size={12} color="var(--text-tertiary)" />
                <input style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 12, color: 'var(--text-primary)' }} placeholder="패키지명 또는 CVE ID…" />
                <span className="mono" style={{ fontSize: 9, color: 'var(--text-tertiary)', padding: '1px 4px', borderRadius: 3, background: 'var(--bg-3)' }}>⌘F</span>
              </div>
            }
          >
            <div className="card" style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <FilterRow label="심각도" items={[
                { tone:'critical', label:'CRITICAL', count:1, active: true },
                { tone:'high', label:'HIGH', count:3, active: true },
                { tone:'medium', label:'MEDIUM', count:1, active: true },
                { tone:'low', label:'LOW', count:0 },
              ]} />
              <div style={{ height: 1, background: 'var(--hairline)' }} />
              <FilterRow label="의존성" items={[
                { label:'전체', count: totalDeps, active: true },
                { label:'직접', count: MOCK_DEPS.filter(d=>d.direct).length },
                { label:'전이', count: MOCK_DEPS.filter(d=>!d.direct).length },
                { tone:'orange', label:'패치 가능', count: vulnDeps },
                { label:'업데이트 필요', count: outdated },
              ]} />
              <div style={{ height: 1, background: 'var(--hairline)' }} />
              <FilterRow label="생태계" items={[
                { label:'npm', count: 10, active: true },
                { label:'pip', count: 0 },
                { label:'maven', count: 0 },
                { label:'cargo', count: 0 },
              ]} />
            </div>
          </Section>

          {/* ─── Table section ─── */}
          <Section
            title="의존성 목록"
            subtitle={`${totalDeps}개 의존성 · ${vulnDeps}개 취약`}
            action={
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-sm btn-ghost" style={{ color: 'var(--text-tertiary)' }}>이름순</button>
                <button className="btn btn-sm" style={{ color: 'var(--orange)' }}>위험도순 ↓</button>
              </div>
            }
          >
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {/* Table header */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1.6fr 0.9fr 0.9fr 1.6fr 1.1fr 1fr 0.6fr',
                gap: 16, padding: '12px 22px',
                fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)',
                background: 'var(--bg-2)',
                borderBottom: '1px solid var(--hairline)',
              }}>
                <span>패키지</span>
                <span>현재</span>
                <span>최신</span>
                <span>CVE</span>
                <span>심각도</span>
                <span>수정 버전</span>
                <span style={{ textAlign: 'right' }}>액션</span>
              </div>

              {/* Rows */}
              {MOCK_DEPS.map((d, di) => {
                const worstSev = d.cves.reduce((acc, c) => {
                  const order = ['low','medium','high','critical'];
                  return order.indexOf(c.severity) > order.indexOf(acc) ? c.severity : acc;
                }, 'low');
                const isOutdated = d.version !== d.latest;
                const hasCves = d.cves.length > 0;
                return (
                  <div key={di} style={{
                    display: 'grid',
                    gridTemplateColumns: '1.6fr 0.9fr 0.9fr 1.6fr 1.1fr 1fr 0.6fr',
                    gap: 16, padding: '14px 22px',
                    alignItems: 'center', fontSize: 12,
                    borderBottom: di === MOCK_DEPS.length - 1 ? 'none' : '1px solid var(--hairline)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Icon name="package" size={13} color={d.direct ? 'var(--orange)' : 'var(--text-tertiary)'} />
                      <div>
                        <div style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{d.name}</div>
                        <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 2 }}>
                          {d.direct ? '직접 의존' : '전이 의존'} · {d.license}
                        </div>
                      </div>
                    </div>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{d.version}</span>
                    <span className="mono" style={{ fontSize: 11, color: isOutdated ? 'var(--orange)' : 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {d.latest}
                      {isOutdated && <Icon name="upload" size={9} />}
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {!hasCves ? (
                        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>—</span>
                      ) : (
                        d.cves.map(c => (
                          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span className="mono" style={{ fontSize: 10, color: SEV_META[c.severity].color, fontWeight: 700 }}>{c.id}</span>
                            <span style={{ fontSize: 9, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>· CVSS {c.cvss}</span>
                          </div>
                        ))
                      )}
                    </div>
                    <div>
                      {!hasCves ? (
                        <span className="chip chip-low">SAFE</span>
                      ) : (
                        <span className={`chip chip-${worstSev}`}>
                          <span className="severity-dot" style={{ background: SEV_META[worstSev].color }} />
                          {SEV_META[worstSev].label}
                        </span>
                      )}
                    </div>
                    <span className="mono" style={{ fontSize: 10, color: hasCves ? 'var(--low)' : 'var(--text-tertiary)' }}>
                      {hasCves ? d.cves[0].fixed : '—'}
                    </span>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                      {hasCves && (
                        <button className="btn btn-sm" style={{ height: 24, background: 'var(--low-dim)', borderColor: 'rgba(34,197,94,0.30)', color: 'var(--low)' }}>
                          <Icon name="zap" size={10} />업데이트
                        </button>
                      )}
                      <button className="btn btn-sm btn-ghost" style={{ height: 24, width: 24, padding: 0, justifyContent: 'center', color: 'var(--text-tertiary)' }}>
                        <Icon name="chevronRight" size={11} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>

          {/* ─── CVE detail section ─── */}
          <Section
            title="CVE 상세"
            subtitle="선택된 취약점 — jsonwebtoken@9.0.0"
            action={
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-sm btn-ghost"><Icon name="externalLink" size={11} />NVD</button>
                <button className="btn btn-sm btn-ghost"><Icon name="copy" size={11} />링크 복사</button>
              </div>
            }
          >
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {/* Detail header */}
              <div style={{
                padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 12,
                background: 'var(--bg-2)',
                borderBottom: '1px solid var(--hairline)',
              }}>
                <span className="mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--critical)' }}>CVE-2022-23529</span>
                <span className="chip chip-critical">
                  <span className="severity-dot" style={{ background: 'var(--critical)' }} />CRITICAL · CVSS 9.8
                </span>
                <span className="chip chip-orange">자동 패치 가능</span>
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>발견 5월 17일</span>
              </div>

              {/* Detail body — clean two-column with breathing room */}
              <div style={{ padding: '22px', display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 32 }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.08em', marginBottom: 8, fontFamily: 'var(--font-mono)' }}>설명</div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: 20 }}>
                    jsonwebtoken 라이브러리가 잘못 구성된 secretOrPublicKey를 받을 때 JWT 검증을 우회할 수 있습니다.
                    공격자가 임의의 JWT를 생성하여 인증을 우회할 수 있어 즉시 패치가 권장됩니다.
                  </p>
                  <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.08em', marginBottom: 10, fontFamily: 'var(--font-mono)' }}>영향받는 사용처</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {['lib/auth.ts:34 verifyToken()', 'middleware.ts:55 requireAuth()'].map(p => (
                      <div key={p} className="mono" style={{
                        fontSize: 11, color: 'var(--text-secondary)',
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '7px 10px', background: 'var(--bg-3)', borderRadius: 6,
                        cursor: 'pointer',
                      }}>
                        <Icon name="code" size={12} color="var(--orange)" />
                        <span style={{ flex: 1 }}>{p}</span>
                        <Icon name="externalLink" size={10} color="var(--text-tertiary)" />
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.08em', marginBottom: 10, fontFamily: 'var(--font-mono)' }}>패치</div>
                  <div style={{ padding: 14, background: 'var(--bg-0)', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: 12, marginBottom: 14, lineHeight: 1.6 }}>
                    <div style={{ color: 'var(--critical)' }}>- "jsonwebtoken": "9.0.0"</div>
                    <div style={{ color: 'var(--low)' }}>+ "jsonwebtoken": "9.0.2"</div>
                  </div>
                  <button className="btn btn-primary" style={{ width: '100%', height: 36, fontSize: 13 }}>
                    <Icon name="zap" size={12} fill="currentColor" />패치 적용 · PR 생성
                  </button>
                  <button className="btn btn-ghost" style={{ width: '100%', height: 32, marginTop: 6, color: 'var(--text-tertiary)' }}>
                    나중에 처리
                  </button>
                </div>
              </div>
            </div>
          </Section>
        </div>
      </div>
    </WindowChrome>
  );
}

function FilterRow({ label, items }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ width: 78, fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{label}</span>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {items.map((it, i) => (
          <Chip key={i} tone={it.tone || 'default'} active={it.active}>
            {it.label} <span style={{ opacity: 0.7, marginLeft: 2 }}>{it.count}</span>
          </Chip>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { SbomCve });
