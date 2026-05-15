'use client';
import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { apiClient, setAccessToken, onUnauthorized, getAccessToken } from '@/lib/api/client';

// ── API response shapes ──────────────────────────────────────────────────────

interface LoginData {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  user: { id: string; email: string; username: string; planId: number; planName: string };
}

interface RegisterData {
  id: string;
  email: string;
  username: string;
}

interface UserMeData {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isAdmin: boolean;
  githubLogin: string | null;
  plan: { id: number; name: string; displayName: string; allowDast: boolean; allowMonitoring: boolean };
  usage: { sastUsageThisMonth: number; sastMonthlyLimit: number; sastResetAt: string };
  credits: { balance: number; hasByok: boolean; preferredModel: string };
  createdAt: string;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth() {
  const router = useRouter();
  const { user, accessToken, isLoading, error, setUser, setAccessToken: storeSetToken, setLoading, setError, setInitialized, logout: storeLogout } = useAuthStore();

  // Sync token into the API client + register logout-on-401 handler
  useEffect(() => {
    setAccessToken(accessToken);
  }, [accessToken]);

  useEffect(() => {
    const unsubscribe = onUnauthorized(() => {
      storeLogout();
      setAccessToken(null);
      router.push('/login');
    });
    return unsubscribe;
  }, [storeLogout, router]);

  // 앱 로드 시 한 번 호출 — refresh 쿠키로 accessToken 복원 (메모리 전용)
  const initAuth = useCallback(async () => {
    if (getAccessToken()) { setInitialized(true); return; }
    try {
      const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api/v1';
      const res = await fetch(`${BASE_URL}/auth/refresh`, { method: 'POST', credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        const token: string | null = json?.data?.accessToken ?? null;
        if (token) {
          setAccessToken(token);
          storeSetToken(token);
          if (!user) await loadUser();
        } else {
          storeLogout();
        }
      } else {
        storeLogout();
      }
    } catch {
      storeLogout();
    } finally {
      setInitialized(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadUser = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<{ data: UserMeData }>('/users/me');
      const u = res.data;
      setUser({
        id: u.id,
        email: u.email,
        username: u.username,
        plan: u.plan.name as 'free' | 'pro' | 'team',
        githubConnected: !!u.githubLogin,
        isAdmin: u.isAdmin ?? false,
        avatarUrl: u.avatarUrl ?? null,
        displayName: u.displayName ?? null,
      });
    } catch {
      storeLogout();
      setAccessToken(null);
    } finally {
      setLoading(false);
    }
  }, [setLoading, setUser, storeLogout]);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.post<{ data: LoginData }>('/auth/login', { email, password });
      const { accessToken: token, user: u } = res.data;
      setAccessToken(token);
      storeSetToken(token);
      setUser({ id: u.id, email: u.email, username: u.username, plan: u.planName as 'free' | 'pro' | 'team', githubConnected: false, isAdmin: false, avatarUrl: null, displayName: null });
      router.push('/editor');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '로그인에 실패했습니다.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [router, setError, setLoading, setUser, storeSetToken]);

  const register = useCallback(async (
    email: string,
    username: string,
    password: string,
    displayName?: string,
  ) => {
    setLoading(true);
    setError(null);
    try {
      await apiClient.post<{ data: RegisterData }>('/auth/register', { email, username, password, displayName });
      router.push('/login?registered=1');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '회원가입에 실패했습니다.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [router, setError, setLoading]);

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch { /* ignore */ }
    storeLogout();
    setAccessToken(null);
    router.push('/');
  }, [storeLogout, router]);

  return { user, accessToken, isLoading, error, login, register, logout, loadUser, initAuth };
}
