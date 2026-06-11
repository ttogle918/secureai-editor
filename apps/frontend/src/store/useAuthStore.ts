import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserPlan = 'free' | 'pro' | 'team';

export type WorkspaceMode = 'DEVELOPER' | 'SECURITY_MANAGER' | 'BOTH';

export type AuthUser = {
  id: string;
  email: string;
  username: string;
  plan: UserPlan;
  githubConnected: boolean;
  isAdmin: boolean;
  avatarUrl: string | null;
  displayName: string | null;
  workspaceMode: WorkspaceMode;
};

interface AuthStore {
  user: AuthUser | null;
  accessToken: string | null;  // 메모리에만 존재 — localStorage 저장 안 함
  isLoading: boolean;
  isInitialized: boolean;      // 앱 로드 시 silent refresh 완료 여부
  error: string | null;
  /** localStorage에서 user 복원 완료 여부 — SSR hydration mismatch 방지용 */
  _hasHydrated: boolean;

  setUser: (user: AuthUser | null) => void;
  setAccessToken: (token: string | null) => void;
  setLoading: (v: boolean) => void;
  setInitialized: (v: boolean) => void;
  setError: (msg: string | null) => void;
  logout: () => void;
  setHasHydrated: (v: boolean) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isLoading: false,
      isInitialized: false,
      error: null,
      _hasHydrated: false,

      setUser: (user) => set({ user }),
      setAccessToken: (accessToken) => set({ accessToken }),
      setLoading: (isLoading) => set({ isLoading }),
      setInitialized: (isInitialized) => set({ isInitialized }),
      setError: (error) => set({ error }),
      logout: () => set({ user: null, accessToken: null, error: null }),
      setHasHydrated: (v) => set({ _hasHydrated: v }),
    }),
    {
      name: 'secureai-auth',
      // accessToken은 메모리에만 — user 정보만 localStorage에 저장 (빠른 UI 렌더링용)
      partialize: (state) => ({ user: state.user }),
      // localStorage 복원 완료 시점을 정확히 감지
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
