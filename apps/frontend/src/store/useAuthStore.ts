import { create } from 'zustand';

export type UserPlan = 'free' | 'pro' | 'team';

export type AuthUser = {
  id: string;
  email: string;
  username: string;
  plan: UserPlan;
  githubConnected: boolean;
};

interface AuthStore {
  user: AuthUser | null;
  accessToken: string | null;
  isLoading: boolean;
  error: string | null;

  setUser: (user: AuthUser | null) => void;
  setAccessToken: (token: string | null) => void;
  setLoading: (v: boolean) => void;
  setError: (msg: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  accessToken: null,
  isLoading: false,
  error: null,

  setUser: (user) => set({ user }),
  setAccessToken: (accessToken) => set({ accessToken }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  logout: () => set({ user: null, accessToken: null, error: null }),
}));
