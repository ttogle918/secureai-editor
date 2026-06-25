/**
 * useSecureStore — 벌크 낙관적 갱신 단위 테스트
 * optimisticUpdateManyVulnStatus / rollbackManyVulnStatus
 */
import { act } from '@testing-library/react';
import { useSecureStore } from '@/store/useSecureStore';
import type { Vulnerability } from '@/lib/mockData';

// 테스트용 취약점 목 데이터
const MOCK_VULNS: Vulnerability[] = [
  { id: 'v1', type: 'SQL_INJECTION', severity: 'critical', lineStart: 10, lineEnd: 12, filePath: 'A.java', description: '', cweId: 'CWE-89', owaspCategory: 'A3', status: 'open' },
  { id: 'v2', type: 'XSS',           severity: 'high',     lineStart: 20, lineEnd: 22, filePath: 'B.java', description: '', cweId: 'CWE-79', owaspCategory: 'A7', status: 'open' },
  { id: 'v3', type: 'SQL_INJECTION', severity: 'critical', lineStart: 30, lineEnd: 32, filePath: 'C.java', description: '', cweId: 'CWE-89', owaspCategory: 'A3', status: 'open' },
];

beforeEach(() => {
  act(() => {
    useSecureStore.getState().clearVulns();
    MOCK_VULNS.forEach((v) => useSecureStore.getState().addVuln(v));
  });
});

afterEach(() => {
  act(() => {
    useSecureStore.getState().clearVulns();
  });
});

describe('useSecureStore — 벌크 낙관적 갱신', () => {
  it('optimisticUpdateManyVulnStatus — 지정한 id의 status를 newStatus로 변경한다', () => {
    act(() => {
      useSecureStore.getState().optimisticUpdateManyVulnStatus(['v1', 'v3'], 'false_positive');
    });

    const vulns = useSecureStore.getState().vulns;
    expect(vulns.find((v) => v.id === 'v1')?.status).toBe('false_positive');
    expect(vulns.find((v) => v.id === 'v2')?.status).toBe('open'); // 미선택
    expect(vulns.find((v) => v.id === 'v3')?.status).toBe('false_positive');
  });

  it('optimisticUpdateManyVulnStatus — 이전 상태 스냅샷을 반환한다', () => {
    let snapshot: Record<string, string> = {};
    act(() => {
      snapshot = useSecureStore.getState().optimisticUpdateManyVulnStatus(['v1', 'v2'], 'fixed');
    });

    expect(snapshot).toEqual({ v1: 'open', v2: 'open' });
    // v3는 요청에 없으므로 스냅샷에 없어야 함
    expect(snapshot['v3']).toBeUndefined();
  });

  it('rollbackManyVulnStatus — 스냅샷에 있는 id만 이전 status로 복원한다', () => {
    let snapshot: Record<string, string> = {};

    act(() => {
      snapshot = useSecureStore.getState().optimisticUpdateManyVulnStatus(['v1', 'v2'], 'fixed');
    });

    // v1, v2는 fixed → 원래 open으로 rollback
    act(() => {
      useSecureStore.getState().rollbackManyVulnStatus(
        snapshot as Record<string, import('@/lib/mockData').VulnStatus>,
      );
    });

    const vulns = useSecureStore.getState().vulns;
    expect(vulns.find((v) => v.id === 'v1')?.status).toBe('open');
    expect(vulns.find((v) => v.id === 'v2')?.status).toBe('open');
    // v3는 롤백 대상 아님
    expect(vulns.find((v) => v.id === 'v3')?.status).toBe('open');
  });

  it('부분 skip 시나리오 — skip된 id만 rollback하면 applied는 유지된다', () => {
    const allIds = ['v1', 'v2', 'v3'];
    const appliedIds = ['v1', 'v3']; // v2는 skip
    let snapshot: Record<string, string> = {};

    act(() => {
      snapshot = useSecureStore.getState().optimisticUpdateManyVulnStatus(allIds, 'false_positive');
    });

    // skip된 v2만 rollback
    const appliedSet = new Set(appliedIds);
    const skippedSnapshot: Record<string, import('@/lib/mockData').VulnStatus> = {};
    for (const id of allIds) {
      if (!appliedSet.has(id) && id in snapshot) {
        skippedSnapshot[id] = snapshot[id] as import('@/lib/mockData').VulnStatus;
      }
    }

    act(() => {
      useSecureStore.getState().rollbackManyVulnStatus(skippedSnapshot);
    });

    const vulns = useSecureStore.getState().vulns;
    expect(vulns.find((v) => v.id === 'v1')?.status).toBe('false_positive'); // applied — 유지
    expect(vulns.find((v) => v.id === 'v2')?.status).toBe('open');            // skip — rollback됨
    expect(vulns.find((v) => v.id === 'v3')?.status).toBe('false_positive'); // applied — 유지
  });
});
