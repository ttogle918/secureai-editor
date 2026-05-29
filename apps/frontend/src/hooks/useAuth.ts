'use client';
import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, type WorkspaceMode } from '@/store/useAuthStore';
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
  workspaceMode?: WorkspaceMode;
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
          // 리프레시 토큰 만료 — 로그인 상태만 해제, 이후 API 호출에서 리다이렉트 처리
          storeLogout();
        }
      } else if (res.status === 401) {
        // 리프레시 쿠키 만료 — 조용히 처리 (로그인 페이지 강제 이동 없음)
        storeLogout();
      } else {
        // 서버 오류 등 — user 정보는 유지, 토큰만 초기화
        setAccessToken(null);
      }
    } catch {
      // 네트워크 오류 — user 정보 유지, 연결 복구 후 재시도 가능
      setAccessToken(null);
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
        workspaceMode: u.workspaceMode ?? 'DEVELOPER',
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
      setUser({ id: u.id, email: u.email, username: u.username, plan: u.planName as 'free' | 'pro' | 'team', githubConnected: false, isAdmin: false, avatarUrl: null, displayName: null, workspaceMode: 'DEVELOPER' });
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
    consent?: { termsAgreed: boolean; privacyAgreed: boolean; marketingAgreed: boolean },
  ) => {
    setLoading(true);
    setError(null);
    try {
      await apiClient.post<{ data: RegisterData }>('/auth/register', {
        email, username, password, displayName,
        termsAgreed: consent?.termsAgreed ?? false,
        privacyAgreed: consent?.privacyAgreed ?? false,
        marketingAgreed: consent?.marketingAgreed ?? false,
      });
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
