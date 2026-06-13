'use client';
import { useState, useEffect, useCallback } from 'react';
import { LogOut } from 'lucide-react';
import { apiClient } from '@/lib/api/client';

interface ActiveSession {
  id: string;
  deviceInfo: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  expiresAt: string;
}

export function ActiveDeviceSection() {
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [revokeStatus, setRevokeStatus] = useState<Record<string, 'idle' | 'revoking'>>({});

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<{ data: ActiveSession[] }>('/users/me/sessions');
      setSessions(res.data ?? []);
    } catch {
      // 로드 실패 시 무시
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleRevokeSession = async (sessionId: string) => {
    setRevokeStatus(prev => ({ ...prev, [sessionId]: 'revoking' }));
    try {
      await apiClient.delete(`/users/me/sessions/${sessionId}`);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
    } catch {
      // 실패 시 상태 복원
    } finally {
      setRevokeStatus(prev => ({ ...prev, [sessionId]: 'idle' }));
    }
  };

  if (loading) {
    return (
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>불러오는 중...</div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.2)' }}>활성 세션이 없습니다.</div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {sessions.map((session) => (
        <div
          key={session.id}
          style={{
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16,
            padding: '14px 16px', borderRadius: 10,
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 13, fontWeight: 600, color: '#e8e8ee', marginBottom: 4,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {session.deviceInfo ?? '알 수 없는 기기'}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 2 }}>
              IP: {session.ip ?? '—'}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>
              로그인: {new Date(session.createdAt).toLocaleString('ko-KR')}
            </div>
          </div>
          <button
            onClick={() => handleRevokeSession(session.id)}
            disabled={revokeStatus[session.id] === 'revoking'}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '7px 14px', borderRadius: 7, flexShrink: 0,
              background: 'rgba(226,75,75,0.08)',
              border: '1px solid rgba(226,75,75,0.25)',
              color: '#e24b4b', fontSize: 12, cursor: 'pointer',
              opacity: revokeStatus[session.id] === 'revoking' ? 0.5 : 1,
            }}
          >
            <LogOut size={12} />
            {revokeStatus[session.id] === 'revoking' ? '처리 중...' : '로그아웃'}
          </button>
        </div>
      ))}
    </div>
  );
}
