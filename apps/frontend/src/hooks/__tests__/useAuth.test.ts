import { act, renderHook } from '@testing-library/react';
import { useAuth } from '../useAuth';
import { useAuthStore } from '@/store/useAuthStore';
import { apiClient, setAccessToken, getAccessToken, onUnauthorized } from '@/lib/api/client';

// ── mocks ──────────────────────────────────────────────────────────────────────

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/lib/api/client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn() },
  setAccessToken: jest.fn(),
  getAccessToken: jest.fn(),
  onUnauthorized: jest.fn(() => () => {}),
}));

const mockGet = apiClient.get as jest.Mock;
const mockPost = apiClient.post as jest.Mock;
const mockSetAccessToken = setAccessToken as jest.Mock;
const mockGetAccessToken = getAccessToken as jest.Mock;
const mockOnUnauthorized = onUnauthorized as jest.Mock;

function resetStore() {
  useAuthStore.setState({
    user: null, accessToken: null, isLoading: false, isInitialized: false, error: null,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockOnUnauthorized.mockReturnValue(() => {});
  resetStore();
});

// ── login ──────────────────────────────────────────────────────────────────────

describe('useAuth.login', () => {
  it('stores token + user and routes to /editor on success', async () => {
    mockPost.mockResolvedValueOnce({
      data: {
        accessToken: 'tok-1',
        user: { id: 'u1', email: 'a@b.com', username: 'alice', planName: 'pro' },
      },
    });

    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.login('a@b.com', 'pw'); });

    expect(mockPost).toHaveBeenCalledWith('/auth/login', { email: 'a@b.com', password: 'pw' });
    const state = useAuthStore.getState();
    expect(state.accessToken).toBe('tok-1');
    expect(state.user).toMatchObject({ id: 'u1', username: 'alice', plan: 'pro' });
    expect(mockSetAccessToken).toHaveBeenCalledWith('tok-1');
    expect(mockPush).toHaveBeenCalledWith('/editor');
    expect(state.error).toBeNull();
  });

  it('sets the error message and does not navigate on failure', async () => {
    mockPost.mockRejectedValueOnce(new Error('잘못된 자격 증명'));

    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.login('a@b.com', 'bad'); });

    expect(useAuthStore.getState().error).toBe('잘못된 자격 증명');
    expect(useAuthStore.getState().user).toBeNull();
    expect(mockPush).not.toHaveBeenCalled();
  });
});

// ── register ────────────────────────────────────────────────────────────────────

describe('useAuth.register', () => {
  it('posts the registration and routes to /login?registered=1', async () => {
    mockPost.mockResolvedValueOnce({ data: { id: 'u1', email: 'a@b.com', username: 'alice' } });

    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.register('a@b.com', 'alice', 'pw', 'Alice'); });

    expect(mockPost).toHaveBeenCalledWith('/auth/register', {
      email: 'a@b.com', username: 'alice', password: 'pw', displayName: 'Alice',
    });
    expect(mockPush).toHaveBeenCalledWith('/login?registered=1');
  });

  it('sets the error message on failure', async () => {
    mockPost.mockRejectedValueOnce(new Error('이미 존재하는 이메일'));

    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.register('a@b.com', 'alice', 'pw'); });

    expect(useAuthStore.getState().error).toBe('이미 존재하는 이메일');
    expect(mockPush).not.toHaveBeenCalled();
  });
});

// ── logout ──────────────────────────────────────────────────────────────────────

describe('useAuth.logout', () => {
  it('clears auth state and routes home even if the API call fails', async () => {
    useAuthStore.setState({ user: { id: 'u1' } as never, accessToken: 'tok' });
    mockPost.mockRejectedValueOnce(new Error('network'));

    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.logout(); });

    expect(mockPost).toHaveBeenCalledWith('/auth/logout');
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(mockSetAccessToken).toHaveBeenCalledWith(null);
    expect(mockPush).toHaveBeenCalledWith('/');
  });
});

// ── loadUser ────────────────────────────────────────────────────────────────────

describe('useAuth.loadUser', () => {
  it('maps the /users/me payload into the auth store', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        id: 'u1', email: 'a@b.com', username: 'alice', displayName: 'Alice',
        avatarUrl: 'http://x/a.png', isAdmin: true, githubLogin: 'alice-gh',
        plan: { name: 'team' },
      },
    });

    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.loadUser(); });

    expect(mockGet).toHaveBeenCalledWith('/users/me');
    expect(useAuthStore.getState().user).toMatchObject({
      id: 'u1', plan: 'team', githubConnected: true, isAdmin: true,
      avatarUrl: 'http://x/a.png', displayName: 'Alice',
    });
  });

  it('logs out when /users/me fails', async () => {
    useAuthStore.setState({ user: { id: 'u1' } as never, accessToken: 'tok' });
    mockGet.mockRejectedValueOnce(new Error('401'));

    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.loadUser(); });

    expect(useAuthStore.getState().user).toBeNull();
  });
});

// ── initAuth ────────────────────────────────────────────────────────────────────

describe('useAuth.initAuth', () => {
  it('short-circuits and marks initialized when a token already exists', async () => {
    mockGetAccessToken.mockReturnValue('already-have-token');
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.initAuth(); });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(useAuthStore.getState().isInitialized).toBe(true);
  });

  it('restores the token via refresh and loads the user', async () => {
    mockGetAccessToken.mockReturnValue(null);
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { accessToken: 'refreshed-tok' } }),
    }) as unknown as typeof fetch;
    mockGet.mockResolvedValueOnce({
      data: { id: 'u1', email: 'a@b.com', username: 'alice', plan: { name: 'free' }, githubLogin: null },
    });

    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.initAuth(); });

    expect(useAuthStore.getState().accessToken).toBe('refreshed-tok');
    expect(useAuthStore.getState().user).toMatchObject({ id: 'u1', plan: 'free' });
    expect(useAuthStore.getState().isInitialized).toBe(true);
  });

  it('silently clears login state on a 401 refresh', async () => {
    mockGetAccessToken.mockReturnValue(null);
    useAuthStore.setState({ user: { id: 'u1' } as never });
    global.fetch = jest.fn().mockResolvedValueOnce({ ok: false, status: 401 }) as unknown as typeof fetch;

    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.initAuth(); });

    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isInitialized).toBe(true);
    expect(mockPush).not.toHaveBeenCalled();
  });
});
