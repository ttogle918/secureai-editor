/**
 * useDastBatchStream — 배치 DAST SSE 훅 단위 테스트
 * - dast_result 이벤트: setDastExploitResult 호출
 * - dast_batch_complete 이벤트: setDastBatchSummary 호출 + 세션 닫힘
 * - dast_error 이벤트: 에러 로그 추가 + 세션 닫힘
 */
import { act, renderHook } from '@testing-library/react';
import { useSecureStore } from '@/store/useSecureStore';
import { useDastBatchStream } from '../useDastBatchStream';

// ── EventSource 모킹 ─────────────────────────────────────────────────────────
type ESHandler = ((e: MessageEvent) => void) | null;
type ESErrorHandler = ((e: Event) => void) | null;

class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  onmessage: ESHandler = null;
  onerror: ESErrorHandler = null;
  closed = false;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  close() { this.closed = true; }

  emit(data: unknown) {
    this.onmessage?.({
      data: JSON.stringify(data),
    } as MessageEvent);
  }
}

beforeAll(() => {
  global.EventSource = MockEventSource as unknown as typeof EventSource;
});

beforeEach(() => {
  MockEventSource.instances = [];
  act(() => {
    useSecureStore.setState({
      dastBatchSessionId: null,
      dastBatchSummary: null,
      dastLogs: [],
      dastExploitResults: {},
    });
  });
});

const VALID_SESSION_ID = 'a0000000-0000-0000-0000-000000000001';

describe('useDastBatchStream', () => {
  it('dastBatchSessionId가 null이면 EventSource를 생성하지 않는다', () => {
    renderHook(() => useDastBatchStream());
    expect(MockEventSource.instances).toHaveLength(0);
  });

  it('유효한 UUID 세션 id 설정 시 EventSource를 생성하고 배치 쿼리를 붙인다', () => {
    act(() => {
      useSecureStore.setState({ dastBatchSessionId: VALID_SESSION_ID });
    });

    renderHook(() => useDastBatchStream());

    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toContain('?batch=true');
    expect(MockEventSource.instances[0].url).toContain(VALID_SESSION_ID);
  });

  it('UUID 형식이 아닌 세션 id는 무시한다', () => {
    act(() => {
      useSecureStore.setState({ dastBatchSessionId: 'not-a-uuid' });
    });

    renderHook(() => useDastBatchStream());
    expect(MockEventSource.instances).toHaveLength(0);
  });

  it('dast_result 이벤트를 받으면 해당 vulnId에 결과를 저장한다', () => {
    act(() => {
      useSecureStore.setState({ dastBatchSessionId: VALID_SESSION_ID });
    });

    renderHook(() => useDastBatchStream());
    const es = MockEventSource.instances[0];

    act(() => {
      es.emit({
        type: 'dast_result',
        vulnId: 'v1',
        success: true,
        evidence: 'response contains error',
        payload: "' OR 1=1 --",
        responseSnippet: 'SQL syntax error',
        error: null,
        logMessages: ['Attempt 1 succeeded'],
      });
    });

    const results = useSecureStore.getState().dastExploitResults;
    expect(results['v1']).toBeDefined();
    expect(results['v1'].success).toBe(true);
    // 배치 모드: dast_result에서 세션을 닫지 않음
    expect(es.closed).toBe(false);
    expect(useSecureStore.getState().dastBatchSessionId).toBe(VALID_SESSION_ID);
  });

  it('dast_batch_complete 이벤트를 받으면 집계를 저장하고 세션을 닫는다', () => {
    act(() => {
      useSecureStore.setState({ dastBatchSessionId: VALID_SESSION_ID });
    });

    renderHook(() => useDastBatchStream());
    const es = MockEventSource.instances[0];

    act(() => {
      es.emit({ type: 'dast_batch_complete', total: 5, succeeded: 4, skipped: 1 });
    });

    expect(useSecureStore.getState().dastBatchSummary).toEqual({
      total: 5,
      succeeded: 4,
      skipped: 1,
    });
    expect(useSecureStore.getState().dastBatchSessionId).toBeNull();
    expect(es.closed).toBe(true);
  });

  it('dast_error 이벤트를 받으면 에러 로그를 추가하고 세션을 닫는다', () => {
    act(() => {
      useSecureStore.setState({ dastBatchSessionId: VALID_SESSION_ID });
    });

    renderHook(() => useDastBatchStream());
    const es = MockEventSource.instances[0];

    act(() => {
      es.emit({ type: 'dast_error', error: 'target unreachable' });
    });

    const logs = useSecureStore.getState().dastLogs;
    expect(logs.some((l) => l.level === 'error')).toBe(true);
    expect(useSecureStore.getState().dastBatchSessionId).toBeNull();
    expect(es.closed).toBe(true);
  });
});
