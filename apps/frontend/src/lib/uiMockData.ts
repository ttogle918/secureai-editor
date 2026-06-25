// lib/uiMockData.ts
// 백엔드 없이 UI를 렌더링할 때 사용하는 중앙 Mock 데이터
// API 호출 실패 시 각 페이지의 catch 블록에서 이 값으로 fallback 한다.

// ── 사용자 정보 ──────────────────────────────────────────────────────────────
export const MOCK_USER = {
  id: 'demo-user',
  email: 'demo@kkebi.dev',
  name: '김지민',
  username: 'demo',
  displayName: '김지민',
  githubLogin: null as string | null,
  role: 'ADMIN' as const,
  credits: 1240,
  avatarUrl: null as string | null,
  timezone: 'Asia/Seoul',
  locale: 'ko',
  plan: {
    id: 2,
    name: 'pro',
    displayName: 'Pro',
    allowDast: true,
    allowMonitoring: true,
  },
  usage: {
    sastUsageThisMonth: 42,
    sastMonthlyLimit: 200,
    sastResetAt: '2026-06-01T00:00:00Z',
  },
  createdAt: '2026-01-01T00:00:00Z',
};

// ── 조직 목록 ────────────────────────────────────────────────────────────────
export const MOCK_ORGS = [
  {
    id: 'org-1',
    slug: 'demo-team',
    name: 'Demo Team',
    plan: 'pro',
    memberCount: 4,
    projectCount: 3,
    role: 'owner' as const,
  },
];

// ── 팀 멤버 ──────────────────────────────────────────────────────────────────
export const MOCK_MEMBERS = [
  { id: 'm1', name: '김지민', email: 'jimin@kkebi.dev', role: 'OWNER', joinedAt: '2026-01-01' },
  { id: 'm2', name: '이서현', email: 'seohyun@kkebi.dev', role: 'ADMIN', joinedAt: '2026-02-01' },
  { id: 'm3', name: '박민준', email: 'minjun@kkebi.dev', role: 'MEMBER', joinedAt: '2026-03-01' },
];

// ── 크레딧 요약 ──────────────────────────────────────────────────────────────
export const MOCK_CREDITS = {
  balance: 1240,
  total: 2000,
  used: 760,
  remaining: 1240,
  hasByok: false,
  preferredModel: 'claude-haiku-4-5-20251001',
  modelCosts: {
    'claude-haiku-4-5-20251001': 1,
    'claude-sonnet-4-6': 5,
    'claude-opus-4-7': 20,
  },
  resetAt: '2026-06-01T00:00:00Z',
};

// ── 분석 히스토리 ────────────────────────────────────────────────────────────
export const MOCK_HISTORY = [
  { id: 'h1', projectName: 'shop-api',   branch: 'main', status: 'done', vulnCount: 10, date: '2026-05-17' },
  { id: 'h2', projectName: 'shop-admin', branch: 'main', status: 'done', vulnCount: 3,  date: '2026-05-15' },
];

// ── 관리자 유저 목록 ─────────────────────────────────────────────────────────
export const MOCK_ADMIN_USERS = [
  {
    id: 'u1', email: 'jimin@kkebi.dev', username: 'jimin',
    displayName: '김지민', isActive: true, isAdmin: true,
    planId: 2, planName: 'pro', creditBalance: 1240,
    lastLoginAt: '2026-05-18T10:00:00Z', createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'u2', email: 'seohyun@kkebi.dev', username: 'seohyun',
    displayName: '이서현', isActive: true, isAdmin: false,
    planId: 1, planName: 'free', creditBalance: 0,
    lastLoginAt: '2026-05-17T08:30:00Z', createdAt: '2026-02-01T00:00:00Z',
  },
  {
    id: 'u3', email: 'minjun@kkebi.dev', username: 'minjun',
    displayName: '박민준', isActive: false, isAdmin: false,
    planId: 1, planName: 'free', creditBalance: 0,
    lastLoginAt: null, createdAt: '2026-03-01T00:00:00Z',
  },
];
