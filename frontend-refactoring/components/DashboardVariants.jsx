/* global React, Icon, Chip, SeverityChip, WindowChrome, SEV_META, MOCK_VULNS */
// DashboardVariants.jsx — 2 redesigned dashboard variants.

const { useState: useStateDb } = React;

// ─── KPI Card ────────────────────────────────────────────────
function KpiCard({ label, value, sub, color = 'var(--text-primary)', trend, icon }) {
  return (
    <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500, letterSpacing: '0.02em' }}>{label}</span>
        {icon && (
          <span style={{
            width: 22, height: 22, borderRadius: 5,
            background: `${color}1A`, color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><Icon name={icon} size={12} /></span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 28, fontWeight: 700, color, lineHeight: 1, fontFamily: 'var(--font-mono)' }}>{value}</span>
        {sub && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{sub}</span>}
      </div>
      {trend && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: trend.up ? 'var(--low)' : 'var(--critical)' }}>
          <Icon name="trend" size={10} style={{ transform: trend.up ? 'none' : 'scaleY(-1)' }} />
          <span style={{ fontFamily: 'var(--font-mono)' }}>{trend.label}</span>
        </div>
      )}
    </div>
  );
}

// ─── Security Score Ring ─────────────────────────────────────
function ScoreRing({ score = 62, size = 180 }) {
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? 'var(--low)' : score >= 60 ? 'var(--orange)' : 'var(--critical)';

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id="ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.4" />
            <stop offset="100%" stopColor={color} stopOpacity="1" />
          </linearGradient>
        </defs>
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="var(--bg-3)" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={radius} fill="none"
                stroke="url(#ring-grad)" strokeWidth={stroke}
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round" />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', letterSpacing: '0.04em' }}>보안 점수</span>
        <span style={{ fontSize: 48, fontWeight: 700, color, fontFamily: 'var(--font-mono)', lineHeight: 1, margin: '4px 0' }}>{score}</span>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>/ 100</span>
      </div>
    </div>
  );
}

// ─── Severity bar chart ──────────────────────────────────────
function SeverityBars() {
  const counts = {
    critical: MOCK_VULNS.filter(v=>v.severity==='critical').length,
    high: MOCK_VULNS.filter(v=>v.severity==='high').length,
    medium: MOCK_VULNS.filter(v=>v.severity==='medium').length,
    low: MOCK_VULNS.filter(v=>v.severity==='low').length,
  };
  const max = Math.max(...Object.values(counts), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Object.entries(counts).map(([sev, count]) => (
        <div key={sev} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 78, fontSize: 10, fontWeight: 700, color: SEV_META[sev].color, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
            {SEV_META[sev].label}
          </span>
          <div style={{ flex: 1, height: 8, background: 'var(--bg-3)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${(count / max) * 100}%`,
              background: SEV_META[sev].color,
              borderRadius: 4,
              boxShadow: sev === 'critical' ? `0 0 8px ${SEV_META[sev].color}` : 'none',
            }} />
          </div>
          <span style={{ width: 24, textAlign: 'right', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{count}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Trend line ──────────────────────────────────────────────
function TrendLine() {
  const data = [
    { d: '5/10', score: 41 }, { d: '5/11', score: 45 }, { d: '5/12', score: 48 },
    { d: '5/13', score: 52 }, { d: '5/14', score: 55 }, { d: '5/15', score: 60 },
    { d: '5/16', score: 58 }, { d: '5/17', score: 62 },
  ];
  const max = Math.max(...data.map(d => d.score));
  const min = Math.min(...data.map(d => d.score));
  const W = 360, H = 100;
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((d.score - min + 5) / (max - min + 10)) * H;
    return [x, y];
  });
  const path = 'M' + points.map(p => p.join(',')).join(' L');
  const area = path + ` L${W},${H} L0,${H} Z`;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H }}>
        <defs>
          <linearGradient id="trend-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--orange)" stopOpacity="0.30" />
            <stop offset="100%" stopColor="var(--orange)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#trend-grad)" />
        <path d={path} fill="none" stroke="var(--orange)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {points.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={3} fill="var(--bg-0)" stroke="var(--orange)" strokeWidth="2" />
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 9, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
        {data.map((d, i) => <span key={i}>{d.d}</span>)}
      </div>
    </div>
  );
}

// ─── File heatmap ────────────────────────────────────────────
function FileHeatmap() {
  const files = [
    { name: 'api/users/route.ts', c: 1, h: 0, m: 0, l: 0 },
    { name: 'lib/config.ts', c: 1, h: 0, m: 0, l: 0 },
    { name: 'components/comment.tsx', c: 0, h: 1, m: 0, l: 0 },
    { name: 'workers/job.ts', c: 0, h: 1, m: 0, l: 0 },
    { name: 'api/files/[name].ts', c: 0, h: 1, m: 0, l: 0 },
    { name: 'middleware.ts', c: 0, h: 0, m: 1, l: 0 },
    { name: 'utils/hash.ts', c: 0, h: 0, m: 1, l: 0 },
    { name: 'api/auth/login.ts', c: 0, h: 0, m: 1, l: 0 },
    { name: 'app/page.tsx', c: 0, h: 0, m: 0, l: 1 },
    { name: 'lib/auth.ts', c: 0, h: 0, m: 0, l: 1 },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {files.map((f, i) => {
        const total = f.c + f.h + f.m + f.l;
        const intensity = Math.min(1, total / 2);
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="mono" style={{ flex: 1, fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
            <div style={{ display: 'flex', gap: 2, width: 96 }}>
              {[
                { c: f.c, color: 'var(--critical)' },
                { c: f.h, color: 'var(--high)' },
                { c: f.m, color: 'var(--medium)' },
                { c: f.l, color: 'var(--low)' },
              ].map((s, j) => (
                <div key={j} style={{
                  flex: 1, height: 18, borderRadius: 3,
                  background: s.c > 0 ? s.color : 'var(--bg-3)',
                  opacity: s.c > 0 ? Math.min(1, 0.5 + s.c * 0.25) : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 700, color: '#fff',
                }}>
                  {s.c > 0 && s.c}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── OWASP coverage matrix ───────────────────────────────────
function OwaspMatrix() {
  const rows = [
    { id:'A01', name:'Access Control', count: 2, sev:'high' },
    { id:'A02', name:'Crypto Failures', count: 1, sev:'medium' },
    { id:'A03', name:'Injection', count: 2, sev:'critical' },
    { id:'A04', name:'Insecure Design', count: 1, sev:'medium' },
    { id:'A05', name:'Misconfiguration', count: 0 },
    { id:'A06', name:'Vulnerable Components', count: 0 },
    { id:'A07', name:'Auth Failures', count: 1, sev:'critical' },
    { id:'A08', name:'Integrity', count: 1, sev:'high' },
    { id:'A09', name:'Logging', count: 1, sev:'low' },
    { id:'A10', name:'SSRF', count: 0 },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
      {rows.map(r => {
        const hit = r.count > 0;
        const color = hit ? SEV_META[r.sev].color : 'var(--text-disabled)';
        return (
          <div key={r.id} style={{
            padding: 10, borderRadius: 6,
            background: hit ? SEV_META[r.sev].dim : 'var(--bg-3)',
            border: `1px solid ${hit ? color : 'var(--border)'}`,
            opacity: hit ? 1 : 0.55,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span className="mono" style={{ fontSize: 10, fontWeight: 700, color }}>{r.id}</span>
              {hit && <span style={{ fontSize: 14, fontWeight: 700, color, marginLeft: 'auto', fontFamily: 'var(--font-mono)' }}>{r.count}</span>}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.3 }}>{r.name}</div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Card wrapper with title row ─────────────────────────────
function CardSection({ title, subtitle, action, children, style }) {
  return (
    <div className="card" style={{ padding: 16, ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14, gap: 8 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</div>
          {subtitle && <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{subtitle}</div>}
        </div>
        <div style={{ flex: 1 }} />
        {action}
      </div>
      {children}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// V1 — Analyst (Classic Grid, Information-Dense)
// ═════════════════════════════════════════════════════════════════════
function DashboardV1Analyst({ width = 1440, height = 900 }) {
  return (
    <WindowChrome width={width} height={height} title="Pagori · Dashboard · shop-api">
      <div style={{
        height: 48, flexShrink: 0,
        background: 'var(--bg-1)',
        borderBottom: '1px solid var(--hairline)',
        display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 24, height: 24, borderRadius: 6,
            background: 'linear-gradient(135deg, var(--orange), var(--orange-2))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="shield" size={13} color="#fff" stroke={2.2} fill="#fff" />
          </div>
          <span style={{ fontSize: 13, fontWeight: 700 }}>Security Dashboard</span>
          <Icon name="chevronRight" size={11} color="var(--text-tertiary)" />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>shop-api · main</span>
        </div>
        <div style={{ flex: 1 }} />

        {/* Time range */}
        <div style={{ display: 'flex', padding: 2, background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 6, height: 26 }}>
          {['24h','7d','30d','전체'].map((r, i) => (
            <button key={r} style={{
              padding: '0 10px', border: 'none', borderRadius: 4,
              background: i === 1 ? 'var(--bg-1)' : 'transparent',
              color: i === 1 ? 'var(--text-primary)' : 'var(--text-tertiary)',
              fontSize: 10, fontWeight: 600, cursor: 'pointer',
            }}>{r}</button>
          ))}
        </div>

        <button className="btn btn-sm"><Icon name="download" size={11} />PDF 리포트</button>
        <button className="btn btn-sm btn-primary"><Icon name="refresh" size={11} />다시 분석</button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 20, background: 'var(--bg-0)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1320, margin: '0 auto' }}>
          {/* KPI row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
            <KpiCard label="보안 점수" value="62" sub="/ 100" color="var(--orange)" icon="shield" trend={{ up: true, label: '+7 vs 어제' }} />
            <KpiCard label="CRITICAL" value="2" color="var(--critical)" icon="alert" trend={{ up: false, label: '+1 신규' }} />
            <KpiCard label="HIGH" value="3" color="var(--high)" icon="shieldAlert" />
            <KpiCard label="MEDIUM" value="3" color="var(--medium)" icon="bug" />
            <KpiCard label="패치 완료율" value="20%" color="var(--low)" icon="check" sub="(2/10)" trend={{ up: true, label: '+10%' }} />
          </div>

          {/* Trend + Severity */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
            <CardSection title="보안 점수 트렌드" subtitle="최근 8일" action={<span className="chip chip-orange">+21점</span>}>
              <TrendLine />
            </CardSection>
            <CardSection title="심각도별 분포" subtitle="총 10건">
              <div style={{ paddingTop: 6 }}>
                <SeverityBars />
              </div>
            </CardSection>
          </div>

          {/* OWASP + Heatmap */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <CardSection title="OWASP Top 10 커버리지" subtitle="감지된 카테고리 7/10">
              <OwaspMatrix />
            </CardSection>
            <CardSection title="파일별 취약점 히트맵" subtitle="상위 10개 파일" action={
              <div style={{ display: 'flex', gap: 6, fontSize: 9, color: 'var(--text-tertiary)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span className="severity-dot" style={{ background: 'var(--critical)' }} />C</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span className="severity-dot" style={{ background: 'var(--high)' }} />H</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span className="severity-dot" style={{ background: 'var(--medium)' }} />M</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span className="severity-dot" style={{ background: 'var(--low)' }} />L</span>
              </div>
            }>
              <FileHeatmap />
            </CardSection>
          </div>

          {/* Vuln table preview */}
          <CardSection title="취약점 상세 목록" subtitle="필터 적용 가능" action={
            <div style={{ display: 'flex', gap: 6 }}>
              <Chip tone="critical" active>CRITICAL 2</Chip>
              <Chip tone="high" active>HIGH 3</Chip>
              <Chip tone="medium">MEDIUM 3</Chip>
              <Chip tone="low">LOW 2</Chip>
              <Chip tone="orange">DAST EXPLOITED 1</Chip>
            </div>
          }>
            <div style={{ marginTop: -8 }}>
              <div style={{
                display: 'grid', gridTemplateColumns: '24px 1.5fr 2fr 1fr 1fr auto',
                gap: 12, padding: '8px 0', fontSize: 10,
                color: 'var(--text-tertiary)', borderBottom: '1px solid var(--hairline)',
                fontWeight: 700, letterSpacing: '0.04em', fontFamily: 'var(--font-mono)',
              }}>
                <span></span><span>유형</span><span>파일</span><span>CWE / OWASP</span><span>태그</span><span>상태</span>
              </div>
              {MOCK_VULNS.slice(0, 5).map(v => (
                <div key={v.id} style={{
                  display: 'grid', gridTemplateColumns: '24px 1.5fr 2fr 1fr 1fr auto',
                  gap: 12, padding: '10px 0', alignItems: 'center',
                  fontSize: 12, borderBottom: '1px solid var(--hairline)',
                }}>
                  <span className="severity-dot" style={{ background: SEV_META[v.severity].color, boxShadow: v.severity === 'critical' ? `0 0 6px ${SEV_META[v.severity].color}` : 'none' }} />
                  <span style={{ fontWeight: 600 }}>{v.type}</span>
                  <span className="mono" style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{v.file}:{v.line}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{v.cwe}</span>
                  <span style={{ display: 'flex', gap: 4 }}>
                    {v.tags.slice(0, 2).map(t => <span key={t} className="chip" style={{ height: 18, fontSize: 8 }}>{t}</span>)}
                  </span>
                  <span className={`chip chip-${v.status === 'patched' ? 'low' : v.severity}`} style={{ height: 20, fontSize: 9 }}>
                    {v.status === 'patched' ? 'PATCHED' : SEV_META[v.severity].label}
                  </span>
                </div>
              ))}
            </div>
          </CardSection>
        </div>
      </div>
    </WindowChrome>
  );
}

// ═════════════════════════════════════════════════════════════════════
// V2 — Executive (Hero score, narrative layout)
// ═════════════════════════════════════════════════════════════════════
function DashboardV2Executive({ width = 1440, height = 900 }) {
  return (
    <WindowChrome width={width} height={height} title="Pagori · Dashboard · shop-api">
      <div style={{
        height: 48, flexShrink: 0,
        background: 'var(--bg-1)',
        borderBottom: '1px solid var(--hairline)',
        display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: 'linear-gradient(135deg, var(--orange), var(--orange-2))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="shield" size={13} color="#fff" stroke={2.2} fill="#fff" />
          </div>
          <span style={{ fontSize: 13, fontWeight: 700 }}>Executive Summary</span>
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn btn-sm"><Icon name="download" size={11} />PDF</button>
        <button className="btn btn-sm btn-primary"><Icon name="refresh" size={11} />다시 분석</button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg-0)' }}>
        {/* Hero */}
        <div style={{
          padding: '32px 32px 24px',
          background: 'radial-gradient(circle at 30% 0%, var(--orange-dim) 0%, transparent 50%)',
          borderBottom: '1px solid var(--hairline)',
        }}>
          <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 40 }}>
            <ScoreRing score={62} size={200} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>
                shop-api · main · 5월 17일 분석
              </div>
              <h1 style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.2, marginBottom: 12, letterSpacing: '-0.02em' }}>
                즉시 조치 필요한 취약점 <span style={{ color: 'var(--critical)' }}>2건</span>이 있습니다
              </h1>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 640 }}>
                SQL Injection과 하드코딩된 시크릿이 main 브랜치에 노출되어 있습니다.
                AI가 두 건 모두 자동 패치를 생성했으며, 검토 후 적용하면 보안 점수는 <strong style={{ color: 'var(--low)' }}>89점</strong>까지 상승합니다.
              </p>
              <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
                <button className="btn btn-primary btn-lg"><Icon name="zap" size={13} fill="currentColor" />추천 패치 검토</button>
                <button className="btn btn-lg"><Icon name="externalLink" size={12} />취약점 목록</button>
                <button className="btn btn-lg btn-ghost"><Icon name="download" size={12} />리포트 다운로드</button>
              </div>
            </div>

            {/* Stat column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 200 }}>
              {[
                { label: 'CRITICAL', count: 2, color: 'var(--critical)' },
                { label: 'HIGH', count: 3, color: 'var(--high)' },
                { label: 'MEDIUM', count: 3, color: 'var(--medium)' },
                { label: 'LOW', count: 2, color: 'var(--low)' },
              ].map(r => (
                <div key={r.label} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '8px 14px', borderRadius: 8,
                  background: 'var(--bg-2)', border: '1px solid var(--border)',
                }}>
                  <span className="severity-dot" style={{ background: r.color, boxShadow: r.label === 'CRITICAL' ? `0 0 6px ${r.color}` : 'none' }} />
                  <span style={{ flex: 1, fontSize: 10, fontWeight: 700, color: r.color, letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>{r.label}</span>
                  <span style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{r.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Detail rows */}
        <div style={{ padding: 24, maxWidth: 1280, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
            <CardSection title="보안 점수 트렌드" subtitle="지난 8일" action={
              <div style={{ display: 'flex', gap: 4 }}>
                <Chip active>스코어</Chip>
                <Chip>취약점 수</Chip>
              </div>
            }>
              <TrendLine />
            </CardSection>

            <CardSection title="조치 필요 우선순위" subtitle="가장 위험한 3건">
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
                    <Icon name="arrowRight" size={12} color="var(--text-tertiary)" />
                  </div>
                ))}
              </div>
            </CardSection>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <CardSection title="OWASP Top 10 커버리지" subtitle="감지된 카테고리 7/10">
              <OwaspMatrix />
            </CardSection>
            <CardSection title="파일별 핫스팟" subtitle="가장 많이 영향받는 파일">
              <FileHeatmap />
            </CardSection>
          </div>

          {/* AI insight banner */}
          <div style={{
            padding: 20, borderRadius: 10,
            background: 'linear-gradient(135deg, var(--orange-dim) 0%, rgba(129,140,248,0.10) 100%)',
            border: '1px solid rgba(249,115,22,0.30)',
            display: 'flex', alignItems: 'center', gap: 16,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10,
              background: 'var(--orange-2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(234,88,12,0.40)',
              flexShrink: 0,
            }}>
              <Icon name="sparkle" size={20} color="#fff" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--orange)', letterSpacing: '0.06em', marginBottom: 4 }}>AI 인사이트</div>
              <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.55 }}>
                지난 8일간 점수가 +21 상승했습니다. 같은 페이스를 유지하면 <strong>5월 24일에 80점</strong>에 도달합니다.
                현재 가장 큰 리스크는 <code>api/users/route.ts</code>의 SQL Injection — 패치 적용 시 즉시 +15점.
              </div>
            </div>
            <button className="btn btn-primary"><Icon name="zap" size={12} fill="currentColor" />지금 패치</button>
          </div>
        </div>
      </div>
    </WindowChrome>
  );
}

Object.assign(window, { DashboardV1Analyst, DashboardV2Executive });
