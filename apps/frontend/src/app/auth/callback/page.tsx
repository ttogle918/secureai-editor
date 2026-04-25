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
    const token = searchParams.get('accessToken');
    if (!token) {
      setError('GitHub 인증에 실패했습니다.');
      router.push('/login');
      return;
    }

    setAccessToken(token);
    storeSetToken(token);

    apiClient.get<{ data: {
      id: string; email: string; username: string;
      plan: { name: string }; githubLogin: string | null;
    } }>('/users/me')
      .then((res) => {
        const u = res.data;
        setUser({
          id: u.id,
          email: u.email,
          username: u.username,
          plan: u.plan.name as 'free' | 'pro' | 'team',
          githubConnected: !!u.githubLogin,
        });
        router.push('/');
      })
      .catch(() => {
        setError('사용자 정보를 불러오는 데 실패했습니다.');
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
