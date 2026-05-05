import { renderHook, waitFor } from '@testing-library/react';
import { useSse, type ProgressEvent } from '../useSse';

// ── localStorage mock ──────────────────────────────────────────────────────
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  clear:   jest.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// ── SSE 응답용 ReadableStream 팩토리 ───────────────────────────────────────
function createSseStream(jsonPayloads: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const lines   = jsonPayloads.map((p) => `data: ${p}\n\n`);
  let index     = 0;

  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < lines.length) {
        controller.enqueue(encoder.encode(lines[index++]));
      } else {
        controller.close();
      }
    },
  });
}

// ── fetch mock 헬퍼 ────────────────────────────────────────────────────────
function mockFetchWith(body: ReadableStream | null, status = 200) {
  global.fetch = jest.fn().mockResolvedValue({
    status,
    ok:     status >= 200 && status < 300,
    body,
  } as unknown as Response);
}

afterEach(() => {
  jest.restoreAllMocks();
  (global.fetch as jest.Mock)?.mockReset?.();
  localStorageMock.getItem.mockReset();
});

// ── 테스트 ─────────────────────────────────────────────────────────────────

describe('useSse', () => {
  it('sessionId가 null이면 onStatusChange("idle") 호출', () => {
    const onEvent        = jest.fn();
    const onStatusChange = jest.fn();

    renderHook(() => useSse({ sessionId: null, onEvent, onStatusChange }));

    expect(onStatusChange).toHaveBeenCalledWith('idle');
    expect(global.fetch).toBeUndefined(); // fetch 미호출
  });

  it('JWT 토큰 없으면 onStatusChange("auth_error") 호출', async () => {
    localStorageMock.getItem.mockReturnValue(null); // JWT 없음
    const onEvent        = jest.fn();
    const onStatusChange = jest.fn();

    renderHook(() => useSse({ sessionId: 'session-123', onEvent, onStatusChange }));

    await waitFor(() => {
      expect(onStatusChange).toHaveBeenCalledWith('auth_error');
    });
    expect(onEvent).not.toHaveBeenCalled();
  });

  it('401 응답 시 onStatusChange("auth_error") 호출되고 재연결 안 함', async () => {
    localStorageMock.getItem.mockReturnValue('mock-jwt');
    mockFetchWith(null, 401);
    const onEvent        = jest.fn();
    const onStatusChange = jest.fn();

    renderHook(() => useSse({ sessionId: 'session-456', onEvent, onStatusChange }));

    await waitFor(() => {
      expect(onStatusChange).toHaveBeenCalledWith('auth_error');
    });
    // 401 후 재연결 없음 — fetch는 딱 1번만 호출됨
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('vuln_found 이벤트 수신 시 onEvent 호출', async () => {
    localStorageMock.getItem.mockReturnValue('mock-jwt');

    const vulnEvent: ProgressEvent = {
      sessionId: 'session-789',
      type:      'vuln_found',
      file:      'UserAuth.java',
      message:   'SQL Injection detected',
    };

    mockFetchWith(createSseStream([JSON.stringify(vulnEvent)]));

    const onEvent        = jest.fn();
    const onStatusChange = jest.fn();

    renderHook(() =>
      useSse({ sessionId: 'session-789', onEvent, onStatusChange }),
    );

    await waitFor(() => {
      expect(onEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'vuln_found', file: 'UserAuth.java' }),
      );
    });
  });

  it('completed 이벤트 수신 시 onStatusChange("closed") 호출', async () => {
    localStorageMock.getItem.mockReturnValue('mock-jwt');

    const completedEvent: ProgressEvent = {
      sessionId: 'session-abc',
      type:      'completed',
    };

    mockFetchWith(createSseStream([JSON.stringify(completedEvent)]));

    const onEvent        = jest.fn();
    const onStatusChange = jest.fn();

    renderHook(() =>
      useSse({ sessionId: 'session-abc', onEvent, onStatusChange }),
    );

    await waitFor(() => {
      expect(onStatusChange).toHaveBeenCalledWith('closed');
    });
  });

  it('[DONE] 메시지는 onEvent를 호출하지 않음', async () => {
    localStorageMock.getItem.mockReturnValue('mock-jwt');
    mockFetchWith(createSseStream(['[DONE]']));

    const onEvent        = jest.fn();
    const onStatusChange = jest.fn();

    renderHook(() =>
      useSse({ sessionId: 'session-done', onEvent, onStatusChange }),
    );

    // 스트림이 닫힐 때까지 대기 (closed 상태)
    await waitFor(() => {
      expect(onStatusChange).toHaveBeenCalledWith('closed');
    });
    expect(onEvent).not.toHaveBeenCalled();
  });

  it('잘못된 JSON은 skip하고 세션 중단 없음', async () => {
    localStorageMock.getItem.mockReturnValue('mock-jwt');

    const validEvent: ProgressEvent = { sessionId: 's', type: 'completed' };
    // 두 번째 줄: 유효한 이벤트 → 첫 번째: invalid JSON
    mockFetchWith(createSseStream(['NOT_VALID_JSON', JSON.stringify(validEvent)]));

    const onEvent        = jest.fn();
    const onStatusChange = jest.fn();

    renderHook(() =>
      useSse({ sessionId: 'session-skip', onEvent, onStatusChange }),
    );

    // completed 이벤트는 정상 처리됨
    await waitFor(() => {
      expect(onStatusChange).toHaveBeenCalledWith('closed');
    });
    // 유효 이벤트 1개만 onEvent 호출 (invalid JSON은 skip)
    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'completed' }));
  });
});
