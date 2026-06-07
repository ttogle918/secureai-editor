import { act } from '@testing-library/react';
import { useAuthStore, type AuthUser } from '../useAuthStore';

const sampleUser: AuthUser = {
  id: 'u1',
  email: 'a@b.com',
  username: 'alice',
  plan: 'pro',
  githubConnected: false,
  isAdmin: false,
  avatarUrl: null,
  displayName: null,
};

beforeEach(() => {
  act(() => {
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isLoading: false,
      isInitialized: false,
      error: null,
    });
  });
  localStorage.clear();
});

describe('useAuthStore', () => {
  it('sets and clears user / token / flags via actions', () => {
    act(() => {
      useAuthStore.getState().setUser(sampleUser);
      useAuthStore.getState().setAccessToken('tok');
      useAuthStore.getState().setLoading(true);
      useAuthStore.getState().setInitialized(true);
      useAuthStore.getState().setError('boom');
    });

    const s = useAuthStore.getState();
    expect(s.user).toEqual(sampleUser);
    expect(s.accessToken).toBe('tok');
    expect(s.isLoading).toBe(true);
    expect(s.isInitialized).toBe(true);
    expect(s.error).toBe('boom');
  });

  it('logout clears user, token and error', () => {
    act(() => {
      useAuthStore.getState().setUser(sampleUser);
      useAuthStore.getState().setAccessToken('tok');
      useAuthStore.getState().setError('boom');
      useAuthStore.getState().logout();
    });

    const s = useAuthStore.getState();
    expect(s.user).toBeNull();
    expect(s.accessToken).toBeNull();
    expect(s.error).toBeNull();
  });

  it('persists the user but never the access token (security)', () => {
    act(() => {
      useAuthStore.getState().setUser(sampleUser);
      useAuthStore.getState().setAccessToken('secret-token');
    });

    const persisted = localStorage.getItem('secureai-auth') ?? '';
    expect(persisted).toContain('alice');
    expect(persisted).not.toContain('secret-token');
  });
});
