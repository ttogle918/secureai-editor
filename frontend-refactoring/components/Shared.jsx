/* global React */
// Shared.jsx — atoms, mock data, severity helpers used across all redesign artboards.

const { useState, useEffect, useRef, useMemo, useCallback } = React;

// ─── Icon — lightweight wrapper for inline SVG paths from Lucide ──────────
// Using inline SVG (no Lucide CDN) keeps the artboard self-contained.
const ICONS = {
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  play: 'M6 4l14 8-14 8z',
  pause: 'M7 4h4v16H7zM13 4h4v16h-4z',
  square: 'M5 5h14v14H5z',
  refresh: 'M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5',
  search: 'M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16zM21 21l-4.3-4.3',
  bell: 'M6 19V11a6 6 0 1 1 12 0v8M4 19h16M10 22h4',
  settings: 'M12 9v0a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  chevronRight: 'M9 18l6-6-6-6',
  chevronDown: 'M6 9l6 6 6-6',
  chevronUp: 'M18 15l-6-6-6 6',
  chevronLeft: 'M15 18l-6-6 6-6',
  x: 'M18 6L6 18M6 6l12 12',
  check: 'M20 6L9 17l-5-5',
  plus: 'M12 5v14M5 12h14',
  arrowRight: 'M5 12h14M12 5l7 7-7 7',
  arrowLeft: 'M19 12H5M12 19l-7-7 7-7',
  zap: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  alert: 'M12 9v4M12 17h.01M10.3 3.86L1.82 18a2 2 0 0 0 1.7 3h16.94a2 2 0 0 0 1.7-3L13.7 3.86a2 2 0 0 0-3.4 0z',
  github: 'M9 19c-5 1.5-5-2.5-7-3m14 6v-3.9c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12 12 0 0 0-6.2 0C6.5 2.3 5.4 2.6 5.4 2.6a4.2 4.2 0 0 0-.1 3.2 4.6 4.6 0 0 0-1.3 3.2c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21',
  folder: 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z',
  folderOpen: 'M6 14l1.5-2.9A2 2 0 0 1 9.3 10H21a2 2 0 0 1 1.8 2.9l-3 5.9A2 2 0 0 1 18 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.7 1l1 1.4a2 2 0 0 0 1.6 1H18a2 2 0 0 1 2 2v2',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6',
  filter: 'M3 6h18l-7 9v6l-4-2v-4z',
  package: 'M12 22V12M3.3 7l8.7 5 8.7-5M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z',
  externalLink: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  code: 'M16 18l6-6-6-6M8 6l-6 6 6 6',
  panel: 'M3 3h18v18H3z M9 3v18',
  layout: 'M3 3h18v18H3zM9 9h12M9 15h12M3 9h6v12',
  star: 'M12 2l3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1z',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  history: 'M3 3v5h5M3 8a9 9 0 1 0 3-6L3 5M12 7v5l3 3',
  layers: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  trash: 'M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
  globe: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z',
  copy: 'M9 9h12v12H9zM5 15H3V3h12v2',
  branch: 'M6 3v12M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM18 9a9 9 0 0 1-9 9',
  command: 'M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z',
  message: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  shieldAlert: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM12 8v4M12 16h.01',
  checkCircle: 'M22 11.1V12a10 10 0 1 1-5.9-9.1M22 4L12 14.01l-3-3',
  xCircle: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM15 9l-6 6M9 9l6 6',
  terminal: 'M4 17l6-6-6-6M12 19h8',
  sparkle: 'M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6zM18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8zM5 4l.5 1.5L7 6l-1.5.5L5 8l-.5-1.5L3 6l1.5-.5z',
  link: 'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 1 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 1 0 7 7l1-1',
  eye: 'M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  mail: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6',
  key: 'M21 2l-2 2m-7.6 7.6a5 5 0 1 1-7-7 5 5 0 0 1 7 7zM15 7l3 3M19 5l-4 4',
  cpu: 'M4 4h16v16H4zM9 9h6v6H9zM9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3',
  trend: 'M22 7L14 15l-4-4L2 19M22 7h-5M22 7v5',
  pieChart: 'M21.2 15.9A10 10 0 1 1 8 2.8M22 12A10 10 0 0 0 12 2v10z',
  barChart: 'M18 20V10M12 20V4M6 20v-6',
  fileText: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8',
  bug: 'M8 2L10 4M16 2l-2 2M12 20v-9M9 11l-4 4 4 4M15 11l4 4-4 4M5 6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6a7 7 0 0 1-14 0z',
  lock: 'M5 11h14v10H5zM7 11V7a5 5 0 0 1 10 0v4',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
};

// ─── Pagori brand mark ────────────────────────────────────
// Use the actual brand PNG so it stays pixel-faithful at any size.
function PagoriMark({ size = 24, style }) {
  return (
    <img
      src="assets/pagori-mark.png"
      alt="Pagori"
      width={size} height={size}
      style={{ display: 'block', objectFit: 'contain', ...style }}
    />
  );
}

// Lockup: P mark + "pagori" wordmark (+ optional subtitle)
function PagoriLockup({ size = 22, subtitle, color = 'var(--text-primary)' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <PagoriMark size={size} />
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
        <span style={{ fontSize: Math.round(size * 0.62), fontWeight: 700, letterSpacing: '-0.01em', color, fontFamily: 'var(--font-sans)' }}>pagori</span>
        {subtitle && (
          <span style={{ fontSize: Math.round(size * 0.40), color: 'var(--text-tertiary)', marginTop: 3, letterSpacing: '0.04em', fontFamily: 'var(--font-mono)' }}>
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}

function Icon({ name, size = 16, color = 'currentColor', stroke = 1.6, fill, style }) {
  const path = ICONS[name];
  if (!path) return null;
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill={fill || 'none'} stroke={color} strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      {path.split('M').slice(1).map((d, i) => <path key={i} d={'M' + d} />)}
    </svg>
  );
}

// ─── Severity helpers ────────────────────────────────────────────
const SEV_META = {
  critical: { color: 'var(--critical)', label: 'CRITICAL', dim: 'var(--critical-dim)' },
  high:     { color: 'var(--high)',     label: 'HIGH',     dim: 'var(--high-dim)' },
  medium:   { color: 'var(--medium)',   label: 'MEDIUM',   dim: 'var(--medium-dim)' },
  low:      { color: 'var(--low)',      label: 'LOW',      dim: 'var(--low-dim)' },
  info:     { color: 'var(--info)',     label: 'INFO',     dim: 'var(--info-dim)' },
};

function SeverityChip({ sev, count, active, onClick, showLabel = true }) {
  const m = SEV_META[sev];
  return (
    <button
      onClick={onClick}
      className={`chip chip-${sev}`}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        opacity: active === false ? 0.45 : 1,
        height: 22,
        outline: active ? `1px solid ${m.color}` : 'none',
        outlineOffset: -1,
      }}
    >
      <span className="severity-dot" style={{ background: m.color }} />
      {showLabel && m.label}
      {count != null && <span style={{ opacity: 0.7, marginLeft: 2 }}>({count})</span>}
    </button>
  );
}

function Chip({ children, tone = 'default', size = 'sm', active, onClick }) {
  const toneClass = tone === 'default' ? '' : `chip-${tone}`;
  return (
    <button
      onClick={onClick}
      className={`chip ${toneClass} ${active ? 'chip-active' : ''}`}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        height: size === 'lg' ? 24 : 20,
        fontSize: size === 'lg' ? 11 : 10,
      }}
    >
      {children}
    </button>
  );
}

// ─── Window chrome — a slick fake-browser frame for full-screen artboards ─
function WindowChrome({ title = 'Pagori — localhost:3000', children, width, height }) {
  return (
    <div style={{
      width, height,
      display: 'flex', flexDirection: 'column',
      background: 'var(--bg-0)',
      borderRadius: 12,
      overflow: 'hidden',
      border: '1px solid var(--border)',
      boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
    }}>
      <div style={{
        height: 32,
        background: 'var(--bg-1)',
        borderBottom: '1px solid var(--hairline)',
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '0 12px',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#ff5f57' }} />
          <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#febc2e' }} />
          <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#28c840' }} />
        </div>
        <div style={{
          flex: 1, textAlign: 'center', fontSize: 11,
          color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)',
        }}>{title}</div>
        <div style={{ width: 39 }} />
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  );
}

// ─── Mock data: vulnerabilities & related ────────────────────────
const MOCK_VULNS = [
  { id:'v1', type:'SQL Injection', severity:'critical', file:'api/users/route.ts', line:42, cwe:'CWE-89', owasp:'A03:2021 Injection', tags:['DAST_EXPLOITED','AUTH'], status:'open', desc:'사용자 입력이 검증 없이 SQL 쿼리에 직접 삽입됩니다.' },
  { id:'v2', type:'Hardcoded Secret', severity:'critical', file:'lib/config.ts', line:18, cwe:'CWE-798', owasp:'A07:2021 Auth Failures', tags:['SECRET'], status:'open', desc:'API 키가 소스 코드에 하드코딩되어 있습니다.' },
  { id:'v3', type:'XSS — Stored', severity:'high', file:'components/comment.tsx', line:73, cwe:'CWE-79', owasp:'A03:2021 Injection', tags:['DAST_DONE','UNSAFE_HTML'], status:'open', desc:'dangerouslySetInnerHTML 사용 시 입력 sanitize 미흡.' },
  { id:'v4', type:'Insecure Deserialization', severity:'high', file:'workers/job.ts', line:128, cwe:'CWE-502', owasp:'A08:2021 Integrity', tags:['DESERIALIZATION'], status:'patched', desc:'JSON.parse 결과를 신뢰하고 그대로 실행.' },
  { id:'v5', type:'Path Traversal', severity:'high', file:'api/files/[name].ts', line:24, cwe:'CWE-22', owasp:'A01:2021 Access Control', tags:['DAST_DONE'], status:'open', desc:'파일명 파라미터가 ../ 시퀀스를 필터링하지 않음.' },
  { id:'v6', type:'Open Redirect', severity:'medium', file:'middleware.ts', line:55, cwe:'CWE-601', owasp:'A01:2021', tags:['REDIRECT'], status:'open', desc:'?next 파라미터가 외부 도메인 검증 없이 사용됨.' },
  { id:'v7', type:'Weak Crypto (MD5)', severity:'medium', file:'utils/hash.ts', line:9, cwe:'CWE-327', owasp:'A02:2021 Crypto', tags:['CRYPTO'], status:'open', desc:'비밀번호 해싱에 MD5 사용.' },
  { id:'v8', type:'Missing Rate Limit', severity:'medium', file:'api/auth/login.ts', line:6, cwe:'CWE-770', owasp:'A04:2021 Insecure Design', tags:['AUTH','RATELIMIT'], status:'open', desc:'로그인 엔드포인트에 rate limit 없음.' },
  { id:'v9', type:'Debug Console Log', severity:'low', file:'app/page.tsx', line:201, cwe:'CWE-209', owasp:'A09:2021 Logging', tags:['QUALITY'], status:'patched', desc:'프로덕션 코드에 console.log 노출.' },
  { id:'v10', type:'Unused Import', severity:'low', file:'lib/auth.ts', line:3, cwe:'CWE-1109', owasp:null, tags:['QUALITY'], status:'open', desc:'사용되지 않는 import — 번들 크기 영향.' },
];

const MOCK_FILES = [
  { type:'folder', name:'src', open: true, children: [
    { type:'folder', name:'app', open: true, children: [
      { type:'folder', name:'api', open: true, children: [
        { type:'folder', name:'users', open: true, children: [
          { type:'file', name:'route.ts', path:'api/users/route.ts', vulns: 1 },
        ]},
        { type:'folder', name:'auth', open: false, children: [
          { type:'file', name:'login.ts', path:'api/auth/login.ts', vulns: 1 },
        ]},
        { type:'folder', name:'files', open: false, children: [
          { type:'file', name:'[name].ts', path:'api/files/[name].ts', vulns: 1 },
        ]},
      ]},
      { type:'file', name:'page.tsx', path:'app/page.tsx', vulns: 1 },
      { type:'file', name:'layout.tsx', path:'app/layout.tsx', vulns: 0 },
    ]},
    { type:'folder', name:'components', open: true, children: [
      { type:'file', name:'comment.tsx', path:'components/comment.tsx', vulns: 1 },
      { type:'file', name:'Button.tsx', path:'components/Button.tsx', vulns: 0 },
    ]},
    { type:'folder', name:'lib', open: false, children: [
      { type:'file', name:'config.ts', path:'lib/config.ts', vulns: 1 },
      { type:'file', name:'auth.ts', path:'lib/auth.ts', vulns: 1 },
    ]},
    { type:'folder', name:'utils', open: false, children: [
      { type:'file', name:'hash.ts', path:'utils/hash.ts', vulns: 1 },
    ]},
    { type:'folder', name:'workers', open: false, children: [
      { type:'file', name:'job.ts', path:'workers/job.ts', vulns: 1 },
    ]},
    { type:'file', name:'middleware.ts', path:'middleware.ts', vulns: 1 },
  ]},
  { type:'file', name:'package.json', path:'package.json', vulns: 0 },
  { type:'file', name:'tsconfig.json', path:'tsconfig.json', vulns: 0 },
];

const MOCK_NOTIFICATIONS = [
  { id:'n1', type:'analysis_done', time:'2분 전', title:'분석 완료', body:'main 브랜치 — 취약점 10개 발견 · Critical 2개', unread: true },
  { id:'n2', type:'cve', time:'18분 전', title:'새 CVE 매칭', body:'next-auth@4.22.1 — CVE-2024-22020 (High)', unread: true },
  { id:'n3', type:'pr', time:'1시간 전', title:'GitHub PR 리뷰', body:'#142 fix: sanitize comment input — Review 완료', unread: false },
  { id:'n4', type:'sla', time:'어제', title:'SLA 초과', body:'Critical 취약점 v1 — 분석 후 30일 경과', unread: false },
];

// Export to window for cross-file access
Object.assign(window, {
  Icon, SeverityChip, Chip, WindowChrome,
  PagoriMark, PagoriLockup,
  SEV_META, MOCK_VULNS, MOCK_FILES, MOCK_NOTIFICATIONS,
});
