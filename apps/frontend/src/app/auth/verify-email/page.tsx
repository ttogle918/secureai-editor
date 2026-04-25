'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function VerifyEmailHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setMessage('유효하지 않은 인증 링크입니다.');
      return;
    }

    fetch(`http://localhost:8080/api/v1/auth/verify-email?token=${token}`)
      .then(async (res) => {
        if (res.ok) {
          setStatus('success');
          setTimeout(() => router.push('/login?verified=1'), 2000);
        } else {
          const json = await res.json().catch(() => ({}));
          setStatus('error');
          setMessage(json?.error?.message ?? '인증에 실패했습니다. 링크가 만료되었을 수 있습니다.');
        }
      })
      .catch(() => {
        setStatus('error');
        setMessage('서버에 연결할 수 없습니다.');
      });
  }, [searchParams, router]);

  return (
    <div style={{
      width: '100%',
      maxWidth: 420,
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12,
      padding: '48px 32px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: '#e8e8ee', marginBottom: 28 }}>
        Secure<span style={{ color: '#ea580c' }}>AI</span>
      </div>

      {status === 'loading' && (
        <>
          <div style={{ fontSize: 24, marginBottom: 16 }}>⏳</div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>이메일 인증 처리 중...</div>
        </>
      )}

      {status === 'success' && (
        <>
          <div style={{ fontSize: 32, marginBottom: 16 }}>✅</div>
          <div style={{ color: '#e8e8ee', fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
            이메일 인증 완료!
          </div>
          <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>
            잠시 후 로그인 페이지로 이동합니다...
          </div>
        </>
      )}

      {status === 'error' && (
        <>
          <div style={{ fontSize: 32, marginBottom: 16 }}>❌</div>
          <div style={{ color: '#e24b4b', fontSize: 14, marginBottom: 24 }}>
            {message}
          </div>
          <Link href="/login" style={{
            display: 'inline-block',
            padding: '10px 24px',
            borderRadius: 6,
            background: '#ea580c',
            color: '#fff',
            fontWeight: 700,
            fontSize: 14,
            textDecoration: 'none',
          }}>
            로그인으로 이동
          </Link>
        </>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#080809',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0 16px',
    }}>
      <Suspense fallback={
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>처리 중...</div>
      }>
        <VerifyEmailHandler />
      </Suspense>
    </div>
  );
}
