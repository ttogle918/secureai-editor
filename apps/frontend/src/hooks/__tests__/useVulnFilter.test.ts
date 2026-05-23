// src/hooks/__tests__/useVulnFilter.test.ts
// useVulnFilter 단위 테스트 — TC-1 ~ TC-5
import { renderHook } from '@testing-library/react';
import { useVulnFilter } from '../useVulnFilter';
import type { Vulnerability } from '@/lib/mockData';

// ── useSecureStore 모킹 ────────────────────────────────────────────────────────
// useVulnFilter 는 스토어에서 vulns / severityFilter / apiGroupFilter 를 읽는다.
// 테스트마다 다른 값을 주입할 수 있도록 변수로 관리한다.
let mockVulns: Vulnerability[] = [];
let mockSeverityFilter: string = 'all';
let mockApiGroupFilter: string | null = null;

jest.mock('@/store/useSecureStore', () => ({
  useSecureStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      vulns: mockVulns,
      severityFilter: mockSeverityFilter,
      apiGroupFilter: mockApiGroupFilter,
    }),
}));

// ── 픽스처 데이터 ─────────────────────────────────────────────────────────────
const makeVuln = (overrides: Partial<Vulnerability>): Vulnerability => ({
  id: 'v-default',
  type: 'Test',
  severity: 'medium',
  lineStart: 1,
  lineEnd: 1,
  filePath: '/src/Test.java',
  description: 'test',
  cweId: 'CWE-0',
  owaspCategory: 'A01:2021',
  status: 'open',
  ...overrides,
});

const VULN_CRITICAL_AUTH = makeVuln({ id: 'v1', severity: 'critical', apiGroup: '/api/auth' });
const VULN_HIGH_AUTH     = makeVuln({ id: 'v2', severity: 'high',     apiGroup: '/api/auth' });
const VULN_HIGH_PAYMENT  = makeVuln({ id: 'v3', severity: 'high',     apiGroup: '/api/payment' });
const VULN_MEDIUM_NONE   = makeVuln({ id: 'v4', severity: 'medium',   apiGroup: undefined });
const VULN_LOW_NONE      = makeVuln({ id: 'v5', severity: 'low',      apiGroup: null as unknown as undefined });

const ALL_VULNS = [
  VULN_CRITICAL_AUTH,
  VULN_HIGH_AUTH,
  VULN_HIGH_PAYMENT,
  VULN_MEDIUM_NONE,
  VULN_LOW_NONE,
];

// ── 각 테스트 전 기본값 초기화 ────────────────────────────────────────────────
beforeEach(() => {
  mockVulns          = [...ALL_VULNS];
  mockSeverityFilter = 'all';
  mockApiGroupFilter = null;
});

// ── 테스트 ────────────────────────────────────────────────────────────────────

describe('useVulnFilter', () => {
  it('TC-1: severityFilter=all, apiGroupFilter=null 이면 전체 반환', () => {
    mockSeverityFilter = 'all';
    mockApiGroupFilter = null;

    const { result } = renderHook(() => useVulnFilter());

    expect(result.current).toHaveLength(ALL_VULNS.length);
    expect(result.current.map((v) => v.id)).toEqual(
      expect.arrayContaining(['v1', 'v2', 'v3', 'v4', 'v5']),
    );
  });

  it('TC-2: severityFilter=critical 이면 critical 취약점만 반환', () => {
    mockSeverityFilter = 'critical';
    mockApiGroupFilter = null;

    const { result } = renderHook(() => useVulnFilter());

    expect(result.current).toHaveLength(1);
    expect(result.current[0].id).toBe('v1');
  });

  it('TC-3: severityFilter=all, apiGroupFilter=/api/auth 이면 auth 그룹만 반환', () => {
    mockSeverityFilter = 'all';
    mockApiGroupFilter = '/api/auth';

    const { result } = renderHook(() => useVulnFilter());

    expect(result.current).toHaveLength(2);
    expect(result.current.map((v) => v.id)).toEqual(
      expect.arrayContaining(['v1', 'v2']),
    );
  });

  it('TC-4: AND 조건 — severityFilter=high, apiGroupFilter=/api/auth → high AND auth만', () => {
    mockSeverityFilter = 'high';
    mockApiGroupFilter = '/api/auth';

    const { result } = renderHook(() => useVulnFilter());

    expect(result.current).toHaveLength(1);
    expect(result.current[0].id).toBe('v2');
  });

  it('TC-5: apiGroupFilter=__none__ 이면 apiGroup null/undefined 취약점만 반환', () => {
    mockSeverityFilter = 'all';
    mockApiGroupFilter = '__none__';

    const { result } = renderHook(() => useVulnFilter());

    // VULN_MEDIUM_NONE (apiGroup: undefined), VULN_LOW_NONE (apiGroup: null)
    expect(result.current).toHaveLength(2);
    expect(result.current.map((v) => v.id)).toEqual(
      expect.arrayContaining(['v4', 'v5']),
    );
    // apiGroup 이 있는 취약점은 포함되지 않아야 함
    expect(result.current.map((v) => v.id)).not.toContain('v1');
    expect(result.current.map((v) => v.id)).not.toContain('v2');
    expect(result.current.map((v) => v.id)).not.toContain('v3');
  });
});
