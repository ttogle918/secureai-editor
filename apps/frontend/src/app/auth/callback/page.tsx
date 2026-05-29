'use client';
import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { setAccessToken, apiClient } from '@/lib/api/client';

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAccessToken: storeSetToken, setUser, setError } = useAuthStore();

  useEffect(() => {
    const code = searchParams.get('code');
    if (!code) {
      setError('GitHub 인증에 실패했습니다.');
      router.push('/login');
      return;
    }

    // 일회용 코드를 서버에 제출하여 실제 액세스 토큰으로 교환
    apiClient.get<{ data: { accessToken: string } }>(`/auth/exchange/${code}`)
      .then((res) => {
        const token = res.data.accessToken;
        setAccessToken(token);
        storeSetToken(token);
        return apiClient.get<{ data: {
          id: string; email: string; username: string;
          plan: { name: string }; githubLogin: string | null;
          workspaceMode?: 'DEVELOPER' | 'SECURITY_MANAGER' | 'BOTH';
        } }>('/users/me');
      })
      .then((res) => {
        const u = res.data;
        setUser({
          id: u.id,
          email: u.email,
          username: u.username,
          plan: u.plan.name as 'free' | 'pro' | 'team',
          githubConnected: !!u.githubLogin,
          isAdmin: false,
          avatarUrl: null,
          displayName: null,
          workspaceMode: u.workspaceMode ?? 'DEVELOPER',
        });
        router.push('/editor');
      })
      .catch(() => {
        setError('GitHub 인증에 실패했습니다.');
        router.push('/login');
      });
  }, [searchParams, router, storeSetToken, setUser, setError]);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#080809',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'rgba(255,255,255,0.5)',
      fontSize: 14,
    }}>
      GitHub 인증 처리 중...
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100vh',
        background: '#080809',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'rgba(255,255,255,0.5)',
        fontSize: 14,
      }}>
        처리 중...
      </div>
    }>
      <CallbackHandler />
    </Suspense>
  );
}
