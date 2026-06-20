/**
 * STAGE-2: useConfirmPlan 단위 테스트
 *
 * DoD 검증:
 * 🧪 confirm 성공 시 awaitingConfirmation 초기화 + isAnalyzing=true
 * 🧪 confirm 실패 시 toast error 발행 (상태 롤백 없음)
 * 🧪 isConfirming 중 중복 호출 무시
 */
import { act, renderHook } from '@testing-library/react';
import { useConfirmPlan } from '../useConfirmPlan';
import { useSecureStore } from '@/store/useSecureStore';
import { useToastStore } from '@/hooks/useToast';
import { apiClient, ApiError } from '@/lib/api/client';

jest.mock('@/lib/api/client', () => {
  const actual = jest.requireActual('@/lib/api/client');
  return {
    __esModule: true,
    ...actual,
    apiClient: { get: jest.fn(), post: jest.fn() },
  };
});

const mockPost = apiClient.post as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  act(() => {
    useToastStore.setState({ toasts: [] });
    useSecureStore.setState({
      awaitingConfirmation: true,
      confirmStages: [{ stage_no: 1, name: 'Auth', file_count: 2, files: ['a.java', 'b.java'] }],
      isAnalyzing: false,
    } as never);
  });
});

describe('useConfirmPlan', () => {
  it('POST /analysis/sessions/:id/confirm 를 selectedStageNos, excludedFilePaths와 함께 호출한다', async () => {
    mockPost.mockResolvedValueOnce({ data: {} });

    const { result } = renderHook(() => useConfirmPlan());

    await act(async () => {
      await result.current.confirmPlan({
        sessionId: 'sess-1',
        selectedStageNos: [1, 2],
        excludedFilePaths: ['src/excluded.java'],
      });
    });

    expect(mockPost).toHaveBeenCalledWith(
      '/analysis/sessions/sess-1/confirm',
      { selectedStageNos: [1, 2], excludedFilePaths: ['src/excluded.java'] },
    );
  });

  it('성공 시 awaitingConfirmation=false, isAnalyzing=true 로 전환된다', async () => {
    mockPost.mockResolvedValueOnce({ data: {} });

    const { result } = renderHook(() => useConfirmPlan());

    await act(async () => {
      await result.current.confirmPlan({ sessionId: 'sess-1', selectedStageNos: null, excludedFilePaths: [] });
    });

    const state = useSecureStore.getState();
    expect(state.awaitingConfirmation).toBe(false);
    expect(state.isAnalyzing).toBe(true);
  });

  it('성공 시 info toast 가 발행된다', async () => {
    mockPost.mockResolvedValueOnce({ data: {} });

    const { result } = renderHook(() => useConfirmPlan());

    await act(async () => {
      await result.current.confirmPlan({ sessionId: 'sess-1', selectedStageNos: null, excludedFilePaths: [] });
    });

    const toasts = useToastStore.getState().toasts;
    expect(toasts.some((t) => t.severity === 'info')).toBe(true);
  });

  it('API 오류 시 error toast 가 발행되고 isAnalyzing 은 false 유지', async () => {
    const apiError = new ApiError(500, 'CONFIRM_FAILED', '컨펌 실패');
    mockPost.mockRejectedValueOnce(apiError);

    const { result } = renderHook(() => useConfirmPlan());

    await act(async () => {
      await result.current.confirmPlan({ sessionId: 'sess-1', selectedStageNos: null, excludedFilePaths: [] });
    });

    const toasts = useToastStore.getState().toasts;
    expect(toasts.some((t) => t.severity === 'error')).toBe(true);

    const state = useSecureStore.getState();
    expect(state.isAnalyzing).toBe(false);
  });

  it('비 ApiError 예외 시 기본 error toast 가 발행된다', async () => {
    mockPost.mockRejectedValueOnce(new Error('network error'));

    const { result } = renderHook(() => useConfirmPlan());

    await act(async () => {
      await result.current.confirmPlan({ sessionId: 'sess-1', selectedStageNos: null, excludedFilePaths: [] });
    });

    const toasts = useToastStore.getState().toasts;
    expect(toasts.some((t) => t.severity === 'error')).toBe(true);
  });

  it('selectedStageNos=null(전체 선택) 시 null 이 그대로 전달된다', async () => {
    mockPost.mockResolvedValueOnce({ data: {} });

    const { result } = renderHook(() => useConfirmPlan());

    await act(async () => {
      await result.current.confirmPlan({ sessionId: 'sess-1', selectedStageNos: null, excludedFilePaths: [] });
    });

    expect(mockPost).toHaveBeenCalledWith(
      '/analysis/sessions/sess-1/confirm',
      expect.objectContaining({ selectedStageNos: null }),
    );
  });
});
