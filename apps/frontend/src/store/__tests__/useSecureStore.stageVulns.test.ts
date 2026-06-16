/**
 * STAGE-1: useSecureStore stageVulns 누적 저장 단위 테스트
 */
import { act, renderHook } from '@testing-library/react';
import { useSecureStore, type StageVulnSummary } from '@/store/useSecureStore';

const SAMPLE_VULNS: StageVulnSummary[] = [
  { id: 'v1', filePath: 'src/A.java', lineNumber: 10, vulnType: 'SQL_INJECTION', severity: 'HIGH' },
  { id: 'v2', filePath: 'src/B.java', lineNumber: 22, vulnType: 'XSS', severity: 'MEDIUM' },
];

// 각 테스트 후 스토어 초기화
afterEach(() => {
  act(() => {
    useSecureStore.getState().clearStageVulns();
  });
});

describe('useSecureStore — stageVulns', () => {
  it('setStageVulns로 stage 취약점을 저장하면 loaded=true로 기록된다', () => {
    act(() => {
      useSecureStore.getState().setStageVulns(1, SAMPLE_VULNS);
    });

    const stageVulns = useSecureStore.getState().stageVulns;
    expect(stageVulns[1]).toBeDefined();
    expect(stageVulns[1].loaded).toBe(true);
    expect(stageVulns[1].vulns).toHaveLength(2);
  });

  it('여러 stage의 취약점을 누적 저장할 수 있다', () => {
    act(() => {
      useSecureStore.getState().setStageVulns(1, SAMPLE_VULNS);
      useSecureStore.getState().setStageVulns(2, [SAMPLE_VULNS[0]]);
    });

    const stageVulns = useSecureStore.getState().stageVulns;
    expect(stageVulns[1].vulns).toHaveLength(2);
    expect(stageVulns[2].vulns).toHaveLength(1);
  });

  it('0건 결과도 loaded=true로 저장된다 (발견 0건 표기용)', () => {
    act(() => {
      useSecureStore.getState().setStageVulns(3, []);
    });

    const entry = useSecureStore.getState().stageVulns[3];
    expect(entry).toBeDefined();
    expect(entry.loaded).toBe(true);
    expect(entry.vulns).toHaveLength(0);
  });

  it('clearStageVulns 후에는 stageVulns가 빈 객체가 된다', () => {
    act(() => {
      useSecureStore.getState().setStageVulns(1, SAMPLE_VULNS);
      useSecureStore.getState().clearStageVulns();
    });

    expect(useSecureStore.getState().stageVulns).toEqual({});
  });

  it('clearStageProgress는 stageVulns도 함께 초기화한다', () => {
    act(() => {
      useSecureStore.getState().setStageVulns(1, SAMPLE_VULNS);
      useSecureStore.getState().clearStageProgress();
    });

    expect(useSecureStore.getState().stageVulns).toEqual({});
    expect(useSecureStore.getState().stageList).toEqual([]);
  });

  it('같은 stageNo를 덮어쓰면 최신 결과로 교체된다', () => {
    const newVulns: StageVulnSummary[] = [
      { id: 'v3', filePath: 'src/C.java', lineNumber: 5, vulnType: 'PATH_TRAVERSAL', severity: 'CRITICAL' },
    ];

    act(() => {
      useSecureStore.getState().setStageVulns(1, SAMPLE_VULNS);
      useSecureStore.getState().setStageVulns(1, newVulns); // 덮어쓰기
    });

    const entry = useSecureStore.getState().stageVulns[1];
    expect(entry.vulns).toHaveLength(1);
    expect(entry.vulns[0].id).toBe('v3');
  });
});
