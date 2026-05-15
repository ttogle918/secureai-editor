'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Shield, CheckCircle, XCircle } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { apiClient, ApiError } from '@/lib/api/client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface InvitationInfo {
  orgName: string;
  orgSlug: string;
  role: string;
  inviterName?: string;
  expired: boolean;
  alreadyUsed: boolean;
}

type PageState = 'loading' | 'valid' | 'invalid' | 'accepting' | 'accepted' | 'declined';

// ── Component ─────────────────────────────────────────────────────────────────

export default function InviteAcceptPage() {
  const router = useRouter();
  const { token } = useParams<{ token: string }>();
  const { user, isInitialized } = useAuthStore();

  const [pageState, setPageState] = useState<PageState>('loading');
  const [invitation, setInvitation] = useState<InvitationInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchInvitation = useCallback(async () => {
    if (!token) {
      setPageState('invalid');
      setErrorMsg('유효하지 않은 초대 링크입니다.');
      return;
    }
    try {
      const res = await apiClient.get<{ data: InvitationInfo }>(`/invitations/${token}`);
      const inv = res.data;
      if (inv.expired) {
        setPageState('invalid');
        setErrorMsg('초대 링크가 만료되었습니다.');
      } else if (inv.alreadyUsed) {
        setPageState('invalid');
        setErrorMsg('이미 사용된 초대 링크입니다.');
      } else {
        setInvitation(inv);
        setPageState('valid');
      }
    } catch (e: unknown) {
      if (e instanceof ApiError && e.status === 404) {
        setErrorMsg('초대 링크를 찾을 수 없습니다.');
      } else {
        setErrorMsg('초대 정보를 불러올 수 없습니다.');
      }
      setPageState('invalid');
    }
  }, [token]);

  useEffect(() => {
    // isInitialized 완료 후 실행 (비인증 허용)
    if (isInitialized) fetchInvitation();
  }, [isInitialized, fetchInvitation]);

  const handleAccept = async () => {
    if (!user) {
      // 로그인 후 이 페이지로 다시 돌아오도록 redirect 파라미터 설정
      router.push(`/login?next=/invite/${token}`);
      return;
    }
    setPageState('accepting');
    try {
      await apiClient.post(`/invitations/${token}/accept`);
      setPageState('accepted');
      setTimeout(() => {
        if (invitation?.orgSlug) {
          router.push(`/team/${invitation.orgSlug}`);
        } else {
          router.push('/team');
        }
      }, 1500);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '초대 수락에 실패했습니다.';
      setErrorMsg(msg);
      setPageState('valid');
    }
  };

  const handleDecline = () => {
    setPageState('declined');
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#0d0d0f', color: '#e8e8ee',
      fontFamily: 'var(--font-sans, system-ui)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      {/* 로고 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 48 }}>
        <Shield size={28} color="#ea580c" />
        <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', color: '#e8e8ee' }}>SecureAI</span>
      </div>

      <div style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 16, padding: '40px 36px',
        width: '100%', maxWidth: 420,
        textAlign: 'center',
      }}>
        {pageState === 'loading' && <LoadingState />}
        {pageState === 'invalid' && <InvalidState message={errorMsg} />}
        {(pageState === 'valid' || pageState === 'accepting') && invitation && (
          <ValidState
            invitation={invitation}
            isLoggedIn={!!user}
            isAccepting={pageState === 'accepting'}
            onAccept={handleAccept}
            onDecline={handleDecline}
            errorMsg={errorMsg}
          />
        )}
        {pageState === 'accepted' && <AcceptedState orgName={invitation?.orgName ?? ''} />}
        {pageState === 'declined' && <DeclinedState />}
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', padding: '20px 0' }}>
      초대 정보를 불러오는 중...
    </div>
  );
}

function InvalidState({ message }: { message: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <XCircle size={48} color="#e24b4b" />
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#e8e8ee', margin: 0 }}>초대 링크 오류</h2>
      <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', margin: 0, lineHeight: 1.6 }}>{message}</p>
    </div>
  );
}

function ValidState({
  invitation,
  isLoggedIn,
  isAccepting,
  onAccept,
  onDecline,
  errorMsg,
}: {
  invitation: InvitationInfo;
  isLoggedIn: boolean;
  isAccepting: boolean;
  onAccept: () => void;
  onDecline: () => void;
  errorMsg: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
      <div style={{
        width: 60, height: 60, borderRadius: '50%',
        background: 'rgba(234,88,12,0.12)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Shield size={28} color="#ea580c" />
      </div>

      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#e8e8ee', margin: '0 0 8px' }}>초대 수락</h2>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', margin: '0 0 4px', lineHeight: 1.6 }}>
          <strong style={{ color: '#e8e8ee' }}>&ldquo;{invitation.orgName}&rdquo;</strong> 팀에 초대되었습니다.
        </p>
        {invitation.inviterName && (
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', margin: 0 }}>초대자: {invitation.inviterName}</p>
        )}
      </div>

      <div style={{
        padding: '10px 20px', borderRadius: 8,
        background: 'rgba(129,140,248,0.08)', border: '1px solid rgba(129,140,248,0.2)',
      }}>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>역할: </span>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#818cf8' }}>{invitation.role}</span>
      </div>

      {!isLoggedIn && (
        <p style={{ fontSize: 12, color: '#f59e0b', margin: 0 }}>
          수락하려면 로그인이 필요합니다.
        </p>
      )}
      {errorMsg && <p style={{ fontSize: 12, color: '#e24b4b', margin: 0 }}>{errorMsg}</p>}

      <div style={{ display: 'flex', gap: 10, width: '100%' }}>
        <button
          onClick={onDecline}
          disabled={isAccepting}
          style={{
            flex: 1, padding: '11px 0', borderRadius: 8, fontSize: 13, fontWeight: 700,
            background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.45)',
            border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer',
          }}
        >
          거절
        </button>
        <button
          onClick={onAccept}
          disabled={isAccepting}
          style={{
            flex: 2, padding: '11px 0', borderRadius: 8, fontSize: 13, fontWeight: 700,
            background: isAccepting ? 'rgba(234,88,12,0.5)' : '#ea580c',
            color: '#fff', border: 'none', cursor: 'pointer',
            boxShadow: isAccepting ? 'none' : '0 4px 12px rgba(234,88,12,0.4)',
          }}
        >
          {isAccepting ? '처리 중...' : isLoggedIn ? '수락하기' : '로그인 후 수락'}
        </button>
      </div>
    </div>
  );
}

function AcceptedState({ orgName }: { orgName: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <CheckCircle size={48} color="#22c55e" />
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#e8e8ee', margin: 0 }}>참가 완료</h2>
      <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', margin: 0 }}>
        <strong style={{ color: '#e8e8ee' }}>{orgName}</strong> 팀에 합류했습니다!
      </p>
      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', margin: 0 }}>팀 대시보드로 이동 중...</p>
    </div>
  );
}

function DeclinedState() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <XCircle size={48} color="rgba(255,255,255,0.2)" />
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#e8e8ee', margin: 0 }}>초대 거절</h2>
      <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', margin: 0, lineHeight: 1.6 }}>
        초대를 거절했습니다. 언제든 다시 초대를 받을 수 있습니다.
      </p>
    </div>
  );
}
