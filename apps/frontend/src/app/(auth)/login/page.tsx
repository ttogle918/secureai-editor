'use client';
import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

function LoginForm() {
  const { login, isLoading, error } = useAuth();
  const searchParams = useSearchParams();
  const registered = searchParams.get('registered');
  const verified = searchParams.get('verified');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login(email, password);
  };

  const githubLoginUrl =
    (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api/v1') + '/auth/github';

  return (
    <div style={{
      width: '100%',
      maxWidth: 400,
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12,
      padding: '36px 32px',
    }}>
      {/* Logo */}
      <div style={{ marginBottom: 28, textAlign: 'center' }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#e8e8ee', letterSpacing: '-0.02em' }}>
          Secure<span style={{ color: '#ea580c' }}>AI</span>
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>
          코드 보안 분석 플랫폼
        </div>
      </div>

      {verified && (
        <div style={{
          background: 'rgba(34,197,94,0.10)',
          border: '1px solid rgba(34,197,94,0.25)',
          borderRadius: 6,
          padding: '10px 14px',
          marginBottom: 20,
          fontSize: 13,
          color: '#22c55e',
        }}>
          이메일 인증이 완료되었습니다. 로그인해 주세요.
        </div>
      )}

      {registered && !verified && (
        <div style={{
          background: 'rgba(34,197,94,0.10)',
          border: '1px solid rgba(34,197,94,0.25)',
          borderRadius: 6,
          padding: '10px 14px',
          marginBottom: 20,
          fontSize: 13,
          color: '#22c55e',
        }}>
          회원가입이 완료되었습니다. 이메일을 확인하여 인증을 완료해 주세요.
        </div>
      )}

      {error && (
        <div style={{
          background: 'rgba(226,75,75,0.10)',
          border: '1px solid rgba(226,75,75,0.25)',
          borderRadius: 6,
          padding: '10px 14px',
          marginBottom: 20,
          fontSize: 13,
          color: '#e24b4b',
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', display: 'block', marginBottom: 6 }}>
            이메일
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="dev@example.com"
            style={inputStyle}
          />
        </div>

        <div>
          <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', display: 'block', marginBottom: 6 }}>
            비밀번호
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            placeholder="••••••••"
            style={inputStyle}
          />
        </div>

        {/* API: POST /api/v1/auth/login — { email, password } → { accessToken, refreshToken } */}
        <button
          type="submit"
          disabled={isLoading}
          style={{
            marginTop: 4,
            padding: '10px 0',
            borderRadius: 6,
            background: isLoading ? 'rgba(234,88,12,0.4)' : '#ea580c',
            color: '#fff',
            fontWeight: 700,
            fontSize: 14,
            border: 'none',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            transition: 'background 0.15s',
          }}
        >
          {isLoading ? '로그인 중...' : '로그인'}
        </button>
      </form>

      <div style={{ margin: '20px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>또는</span>
        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
      </div>

      <a
        href={githubLoginUrl}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: '10px 0',
          borderRadius: 6,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.12)',
          color: '#e8e8ee',
          fontWeight: 600,
          fontSize: 14,
          textDecoration: 'none',
          cursor: 'pointer',
          transition: 'background 0.15s',
        }}
      >
        <GithubIcon />
        GitHub으로 계속하기
      </a>

      <div style={{ marginTop: 24, textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>
        계정이 없으신가요?{' '}
        <Link href="/register" style={{ color: '#ea580c', textDecoration: 'none' }}>
          회원가입
        </Link>
      </div>
    </div>
  );
}

function GithubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
    </svg>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>로딩 중...</div>}>
      <LoginForm />
    </Suspense>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: 6,
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#e8e8ee',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
};
