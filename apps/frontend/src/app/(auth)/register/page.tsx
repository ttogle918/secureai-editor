'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';

export default function RegisterPage() {
  const { register, isLoading, error } = useAuth();

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setLocalError('비밀번호가 일치하지 않습니다.');
      return;
    }
    if (password.length < 8) {
      setLocalError('비밀번호는 8자 이상이어야 합니다.');
      return;
    }
    setLocalError(null);
    await register(email, username, password, displayName || undefined);
  };

  const displayError = localError ?? error;

  return (
    <div style={{
      width: '100%',
      maxWidth: 420,
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
          새 계정 만들기
        </div>
      </div>

      {displayError && (
        <div style={{
          background: 'rgba(226,75,75,0.10)',
          border: '1px solid rgba(226,75,75,0.25)',
          borderRadius: 6,
          padding: '10px 14px',
          marginBottom: 20,
          fontSize: 13,
          color: '#e24b4b',
        }}>
          {displayError}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={labelStyle}>이메일</label>
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
          <label style={labelStyle}>사용자명</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="username"
            placeholder="devuser"
            pattern="[a-zA-Z0-9_]{3,30}"
            title="영문, 숫자, 언더스코어 3~30자"
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>표시 이름 (선택)</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            autoComplete="name"
            placeholder="홍길동"
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>비밀번호</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            placeholder="8자 이상, 대소문자·숫자 포함"
            style={inputStyle}
          />
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
            대문자·소문자·숫자를 각각 1개 이상 포함해야 합니다.
          </div>
        </div>

        <div>
          <label style={labelStyle}>비밀번호 확인</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
            placeholder="••••••••"
            style={inputStyle}
          />
        </div>

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
          {isLoading ? '처리 중...' : '회원가입'}
        </button>
      </form>

      <div style={{ marginTop: 24, textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>
        이미 계정이 있으신가요?{' '}
        <Link href="/login" style={{ color: '#ea580c', textDecoration: 'none' }}>
          로그인
        </Link>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'rgba(255,255,255,0.45)',
  display: 'block',
  marginBottom: 6,
};

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
