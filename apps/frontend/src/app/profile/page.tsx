'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/store/useAuthStore';
import { MOCK_USER } from '@/lib/uiMockData';

interface UserMe {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  githubLogin: string | null;
  timezone: string;
  locale: string;
  plan: { id: number; name: string; displayName: string; allowDast: boolean; allowMonitoring: boolean };
  usage: { sastUsageThisMonth: number; sastMonthlyLimit: number; sastResetAt: string };
  createdAt: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const { accessToken, logout, isInitialized } = useAuthStore();
  const [me, setMe] = useState<UserMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isInitialized) return;
    if (!accessToken) {
      // 백엔드 없이 Demo 모드로 진입할 수 있도록 mock fallback
      setMe(MOCK_USER as UserMe);
      setLoading(false);
      return;
    }
    // API: GET /api/v1/users/me — 현재 로그인 사용자 프로필
    apiClient.get<{ data: UserMe }>('/users/me')
      .then(res => setMe(res.data))
      .catch(() => {
        // API 실패 시 mock 데이터로 fallback
        setMe(MOCK_USER as UserMe);
      })
      .finally(() => setLoading(false));
  }, [isInitialized, accessToken, router]);

  const planColor: Record<string, string> = {
    free: 'rgba(255,255,255,0.35)',
    pro: '#f59e0b',
    team: '#22c55e',
    enterprise: '#818cf8',
  };

  const sastPercent = me
    ? me.usage.sastMonthlyLimit === -1
      ? 0
      : Math.min(100, Math.round((me.usage.sastUsageThisMonth / me.usage.sastMonthlyLimit) * 100))
    : 0;

  return (
    <div style={{ minHeight: '100vh', background: '#080809', color: '#e8e8ee', fontFamily: 'inherit' }}>
      {/* Header */}
      <header style={{
        height: 48, borderBottom: '1px solid rgba(255,255,255,0.08)',
        background: '#0d0d0f', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '0 24px',
      }}>
        <button
          onClick={() => router.push('/')}
          style={{ background: 'none', border: 'none', color: '#ea580c', fontWeight: 800, fontSize: 15, cursor: 'pointer', letterSpacing: '-0.02em' }}
        >
          Secure<span style={{ color: '#e8e8ee' }}>AI</span>
        </button>
        <button
          onClick={() => { logout(); router.push('/login'); }}
          style={{
            fontSize: 12, fontWeight: 600, padding: '5px 14px', borderRadius: 6,
            background: 'rgba(226,75,75,0.10)', color: '#e24b4b',
            border: '1px solid rgba(226,75,75,0.2)', cursor: 'pointer',
          }}
        >
          로그아웃
        </button>
      </header>

      {/* Body */}
      <main style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 32, color: '#e8e8ee' }}>내 프로필</h1>

        {loading && (
          <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14 }}>불러오는 중...</div>
        )}

        {error && (
          <div style={{
            background: 'rgba(226,75,75,0.10)', border: '1px solid rgba(226,75,75,0.25)',
            borderRadius: 8, padding: '14px 18px', color: '#e24b4b', fontSize: 14,
          }}>{error}</div>
        )}

        {me && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* 기본 정보 */}
            <Section title="기본 정보">
              <Row label="이메일" value={me.email} />
              <Row label="사용자명" value={`@${me.username}`} />
              <Row label="표시 이름" value={me.displayName ?? '—'} />
              <Row label="가입일" value={new Date(me.createdAt).toLocaleDateString('ko-KR')} />
            </Section>

            {/* 플랜 */}
            <Section title="플랜">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{
                  fontSize: 13, fontWeight: 700, padding: '4px 12px', borderRadius: 20,
                  background: `${planColor[me.plan.name] ?? '#888'}22`,
                  color: planColor[me.plan.name] ?? '#888',
                  border: `1px solid ${planColor[me.plan.name] ?? '#888'}44`,
                }}>
                  {me.plan.displayName}
                </span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
                  DAST {me.plan.allowDast ? '✓' : '✗'} · 모니터링 {me.plan.allowMonitoring ? '✓' : '✗'}
                </span>
              </div>

              {/* SAST 사용량 */}
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                  <span style={{ color: 'rgba(255,255,255,0.45)' }}>이번 달 SAST 사용량</span>
                  <span style={{ color: '#e8e8ee', fontWeight: 600 }}>
                    {me.usage.sastUsageThisMonth} / {me.usage.sastMonthlyLimit === -1 ? '∞' : me.usage.sastMonthlyLimit}
                  </span>
                </div>
                {me.usage.sastMonthlyLimit !== -1 && (
                  <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)' }}>
                    <div style={{
                      height: '100%', borderRadius: 2,
                      background: sastPercent >= 90 ? '#e24b4b' : sastPercent >= 70 ? '#f59e0b' : '#ea580c',
                      width: `${sastPercent}%`,
                      transition: 'width 0.3s',
                    }} />
                  </div>
                )}
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>
                  초기화일: {new Date(me.usage.sastResetAt).toLocaleDateString('ko-KR')}
                </div>
              </div>
            </Section>

            {/* GitHub 연동 */}
            <Section title="GitHub 연동">
              {me.githubLogin ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#e8e8ee">
                    <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
                  </svg>
                  <span style={{ fontSize: 14, color: '#e8e8ee', fontWeight: 600 }}>@{me.githubLogin}</span>
                  <span style={{ fontSize: 11, color: '#22c55e' }}>연동됨</span>
                </div>
              ) : (
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
                  GitHub 계정이 연동되지 않았습니다.
                </div>
              )}
            </Section>

          </div>
        )}
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: '#1a1a1c', border: '1px solid #2d2d30',
      borderRadius: 10, padding: '20px 24px',
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#ea580c', letterSpacing: '0.08em', marginBottom: 16, textTransform: 'uppercase' }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>{label}</span>
      <span style={{ fontSize: 13, color: '#e8e8ee', fontWeight: 500 }}>{value}</span>
    </div>
  );
}
