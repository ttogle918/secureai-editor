import { act, renderHook } from '@testing-library/react';
import { useStartAnalysis } from '../useStartAnalysis';
import { useSecureStore } from '@/store/useSecureStore';
import { useToastStore } from '@/hooks/useToast';
import { apiClient } from '@/lib/api/client';

jest.mock('@/lib/api/client', () => {
  const actual = jest.requireActual('@/lib/api/client');
  return { __esModule: true, ...actual, apiClient: { get: jest.fn(), post: jest.fn() } };
});

const mockPost = apiClient.post as jest.Mock;
const mockGet = apiClient.get as jest.Mock;

function severities() {
  return useToastStore.getState().toasts.map((t) => t.severity);
}

beforeEach(() => {
  jest.clearAllMocks();
  act(() => {
    useToastStore.setState({ toasts: [] });
    useSecureStore.setState({
      workspaceId: null, workspaceName: null, projectId: null, isAnalyzing: false,
      sseSessionId: null,
    } as never);
  });
});

describe('useStartAnalysis', () => {
  it('is a no-op while an analysis is already running', async () => {
    act(() => { useSecureStore.setState({ isAnalyzing: true } as never); });
    const { result } = renderHook(() => useStartAnalysis());

    await act(async () => { await result.current.startAnalysis(); });

    expect(mockPost).not.toHaveBeenCalled();
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('shows an error toast when no workspace folder is open', async () => {
    const { result } = renderHook(() => useStartAnalysis());

    await act(async () => { await result.current.startAnalysis(); });

    expect(severities()).toContain('error');
    expect(useSecureStore.getState().isAnalyzing).toBe(false);
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('creates a session for an existing project and stores the SSE session id', async () => {
    act(() => {
      useSecureStore.setState({
        workspaceId: 'ws-1', workspaceName: 'proj', projectId: 'p-1', isAnalyzing: false,
      } as never);
    });
    mockPost.mockResolvedValueOnce({ data: { id: 'sess-1' } }); // POST /analysis/sessions

    const { result } = renderHook(() => useStartAnalysis());
    await act(async () => { await result.current.startAnalysis(); });

    expect(mockPost).toHaveBeenCalledWith('/analysis/sessions', expect.objectContaining({
      projectId: 'p-1', workspaceRoot: 'ws-1', sourceType: 'local', force: false,
    }));
    expect(useSecureStore.getState().sseSessionId).toBe('sess-1');
    expect(severities()).toContain('info');
  });

  it('creates the project first when none is selected, then starts the session', async () => {
    act(() => {
      useSecureStore.setState({
        workspaceId: 'ws-2', workspaceName: 'fresh', projectId: null, isAnalyzing: false,
      } as never);
    });
    mockPost
      .mockResolvedValueOnce({ data: { id: 'p-new' } })   // POST /projects
      .mockResolvedValueOnce({ data: { id: 'sess-2' } });  // POST /analysis/sessions

    const { result } = renderHook(() => useStartAnalysis());
    await act(async () => { await result.current.startAnalysis(); });

    expect(mockPost).toHaveBeenNthCalledWith(1, '/projects',
      expect.objectContaining({ name: 'fresh', sourceType: 'local' }));
    expect(useSecureStore.getState().projectId).toBe('p-new');
    expect(useSecureStore.getState().sseSessionId).toBe('sess-2');
  });
});
