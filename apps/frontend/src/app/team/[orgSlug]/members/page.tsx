'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, UserPlus, ChevronDown, Users } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { apiClient } from '@/lib/api/client';
import { Modal } from '@/components/ui/Modal';

// ── Types ─────────────────────────────────────────────────────────────────────

type MemberRole = 'owner' | 'admin' | 'member';

interface Member {
  userId: string;
  username: string;
  email: string;
  role: MemberRole;
  acceptedAt: string | null;
  joinedAt: string | null;
}

interface OrgMeta {
  name: string;
  role: MemberRole;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ROLE_OPTIONS: MemberRole[] = ['admin', 'member'];

const ROLE_BADGE: Record<MemberRole, { bg: string; color: string }> = {
  owner:  { bg: 'rgba(129,140,248,0.15)', color: '#818cf8' },
  admin:  { bg: 'rgba(234,88,12,0.12)',   color: '#ea580c' },
  member: { bg: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' },
};

// ── Toast ─────────────────────────────────────────────────────────────────────

function useToast() {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  return { toast, showToast };
}

function ToastBanner({ toast }: { toast: { message: string; type: 'success' | 'error' } | null }) {
  if (!toast) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 2000,
      padding: '12px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600,
      background: toast.type === 'success' ? 'rgba(34,197,94,0.15)' : 'rgba(226,75,75,0.15)',
      border: `1px solid ${toast.type === 'success' ? 'rgba(34,197,94,0.35)' : 'rgba(226,75,75,0.35)'}`,
      color: toast.type === 'success' ? '#22c55e' : '#e24b4b',
      boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
    }}>
      {toast.message}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MembersPage() {
  const router = useRouter();
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const { user, isInitialized } = useAuthStore();
  const { toast, showToast } = useToast();

  const [meta, setMeta] = useState<OrgMeta | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 초대 모달
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<MemberRole>('member');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');

  // 역할 드롭다운
  const [roleDropdown, setRoleDropdown] = useState<string | null>(null);

  // 제거 확인 다이얼로그
  const [removeConfirmMember, setRemoveConfirmMember] = useState<Member | null>(null);
  const [removing, setRemoving] = useState(false);

  // 재전송 중인 멤버 ID 집합
  const [resendingIds, setResendingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isInitialized && !user) router.replace('/login');
  }, [isInitialized, user, router]);

  const isAdminOrAbove = meta?.role === 'owner' || meta?.role === 'admin';
  const isSelf = (m: Member) => m.userId === user?.id;
  const isPending = (m: Member) => m.acceptedAt == null;

  const fetchMembers = useCallback(async () => {
    if (!orgSlug) return;
    setLoading(true);
    setError('');
    try {
      const [metaRes, membersRes] = await Promise.all([
        apiClient.get<{ data: OrgMeta }>(`/organizations/${orgSlug}`),
        apiClient.get<{ data: Member[] }>(`/organizations/${orgSlug}/members`),
      ]);
      setMeta(metaRes.data);
      setMembers(membersRes.data ?? []);
    } catch (e: unknown) {
      console.warn('[MembersPage] 멤버 목록 불러오기 실패:', e);
      setError('멤버 목록을 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, [orgSlug]);

  useEffect(() => {
    if (user) fetchMembers();
  }, [user, fetchMembers]);

  const closeInviteModal = () => {
    setInviteOpen(false);
    setInviteError('');
    setInviteEmail('');
    setInviteRole('member');
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteError('');
    try {
      await apiClient.post(`/organizations/${orgSlug}/members/invite`, {
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      showToast('초대 메일을 발송했습니다.');
      closeInviteModal();
      fetchMembers();
    } catch (e: unknown) {
      console.warn('[MembersPage] 초대 발송 실패:', e);
      const msg = e instanceof Error ? e.message : '초대에 실패했습니다.';
      setInviteError(msg);
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (member: Member, newRole: MemberRole) => {
    setRoleDropdown(null);
    const prev = member.role;
    // 낙관적 업데이트
    setMembers((list) => list.map((m) => m.userId === member.userId ? { ...m, role: newRole } : m));
    try {
      await apiClient.patch(`/organizations/${orgSlug}/members/${member.userId}/role`, { role: newRole });
      showToast(`${member.username}의 역할을 ${newRole}로 변경했습니다.`);
    } catch (e: unknown) {
      console.warn('[MembersPage] 역할 변경 실패:', e);
      // 롤백
      setMembers((list) => list.map((m) => m.userId === member.userId ? { ...m, role: prev } : m));
      showToast('역할 변경에 실패했습니다.', 'error');
    }
  };

  const openRemoveConfirm = (member: Member) => {
    setRemoveConfirmMember(member);
  };

  const handleRemoveConfirmed = async () => {
    if (!removeConfirmMember) return;
    const target = removeConfirmMember;
    setRemoving(true);
    try {
      await apiClient.delete(`/organizations/${orgSlug}/members/${target.userId}`);
      setMembers((list) => list.filter((m) => m.userId !== target.userId));
      showToast(`${target.username}을(를) 팀에서 제거했습니다.`);
    } catch (e: unknown) {
      console.warn('[MembersPage] 멤버 제거 실패:', e);
      showToast('멤버 제거에 실패했습니다.', 'error');
    } finally {
      setRemoving(false);
      setRemoveConfirmMember(null);
    }
  };

  const handleResendInvite = async (member: Member) => {
    setResendingIds((prev) => new Set(prev).add(member.userId));
    try {
      await apiClient.post(`/organizations/${orgSlug}/members/${member.userId}/resend-invite`);
      showToast(`${member.email}로 초대를 재전송했습니다.`);
    } catch (e: unknown) {
      console.warn('[MembersPage] 초대 재전송 실패:', e);
      showToast('초대 재전송에 실패했습니다.', 'error');
    } finally {
      setResendingIds((prev) => {
        const next = new Set(prev);
        next.delete(member.userId);
        return next;
      });
    }
  };

  if (!isInitialized || !user) return null;

  return (
    <div style={{ minHeight: '100vh', background: '#0d0d0f', color: '#e8e8ee', fontFamily: 'var(--font-sans, system-ui)' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', gap: 16 }}>
        <Link href={`/team/${orgSlug}`} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.4)', textDecoration: 'none', fontSize: 13 }}>
          <ArrowLeft size={15} /> 팀 대시보드
        </Link>
        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.08)' }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: '#e8e8ee' }}>
          {meta?.name ?? orgSlug} 멤버 관리
        </span>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px' }}>
        {/* 초대 버튼 — Admin/Owner만 */}
        {/* API: GET /api/v1/organizations/{orgSlug} — 조직 메타 */}
        {/* API: GET /api/v1/organizations/{orgSlug}/members — 멤버 목록 */}
        {isAdminOrAbove && (
          <div style={{ marginBottom: 24 }}>
            {/* API: POST /api/v1/organizations/{orgSlug}/members/invite — { email, role } */}
            <button
              onClick={() => setInviteOpen(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                background: '#ea580c', color: '#fff', border: 'none', cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(234,88,12,0.35)',
              }}
            >
              <UserPlus size={15} /> 이메일로 초대
            </button>
          </div>
        )}

        {/* 멤버 테이블 */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
          {/* 테이블 헤더 */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 100px 80px 100px 160px',
            padding: '12px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)',
            textTransform: 'uppercase', letterSpacing: '0.07em',
          }}>
            <span>사용자명</span>
            <span>역할</span>
            <span>상태</span>
            <span>가입일</span>
            {isAdminOrAbove && <span style={{ textAlign: 'right' }}>액션</span>}
          </div>

          {loading ? (
            <div style={{ padding: '32px 20px', fontSize: 13, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
              불러오는 중...
            </div>
          ) : error ? (
            <div style={{ padding: '32px 20px', fontSize: 13, color: '#e24b4b', textAlign: 'center' }}>{error}</div>
          ) : members.length === 0 ? (
            /* 빈 팀 상태 */
            <div style={{ padding: '48px 20px', textAlign: 'center' }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'rgba(234,88,12,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px',
              }}>
                <Users size={24} color="rgba(234,88,12,0.6)" />
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.5)', margin: '0 0 8px' }}>
                아직 팀원이 없습니다.
              </p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', margin: '0 0 20px' }}>
                이메일로 동료를 초대해보세요!
              </p>
              {isAdminOrAbove && (
                <button
                  onClick={() => setInviteOpen(true)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                    background: 'rgba(234,88,12,0.12)', color: '#ea580c',
                    border: '1px solid rgba(234,88,12,0.25)', cursor: 'pointer',
                  }}
                >
                  <UserPlus size={14} /> 첫 번째 팀원 초대하기
                </button>
              )}
            </div>
          ) : (
            members.map((m) => (
              <MemberTableRow
                key={m.userId}
                member={m}
                isSelf={isSelf(m)}
                isAdminOrAbove={isAdminOrAbove}
                isPending={isPending(m)}
                roleDropdownOpen={roleDropdown === m.userId}
                resending={resendingIds.has(m.userId)}
                onToggleRoleDropdown={() => setRoleDropdown(roleDropdown === m.userId ? null : m.userId)}
                onRoleChange={(role) => handleRoleChange(m, role)}
                onRemove={() => openRemoveConfirm(m)}
                onResendInvite={() => handleResendInvite(m)}
              />
            ))
          )}
        </div>
      </div>

      {/* 초대 모달 */}
      <Modal isOpen={inviteOpen} onClose={closeInviteModal} title="팀원 초대">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', display: 'block', marginBottom: 6 }}>
              이메일 주소
            </label>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleInvite(); }}
              placeholder="teammate@example.com"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', display: 'block', marginBottom: 6 }}>
              역할
            </label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as MemberRole)}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>{r === 'admin' ? '관리자 (admin)' : '일반 멤버 (member)'}</option>
              ))}
            </select>
          </div>
          {inviteError && <p style={{ fontSize: 12, color: '#e24b4b', margin: 0 }}>{inviteError}</p>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={closeInviteModal} style={secondaryBtnStyle}>취소</button>
            <button
              onClick={handleInvite}
              disabled={!inviteEmail.trim() || inviting}
              style={{
                padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                background: '#ea580c', color: '#fff', border: 'none', cursor: 'pointer',
                opacity: !inviteEmail.trim() || inviting ? 0.5 : 1,
              }}
            >
              {inviting ? '발송 중...' : '초대 보내기'}
            </button>
          </div>
        </div>
      </Modal>

      {/* 제거 확인 다이얼로그 */}
      <Modal
        isOpen={removeConfirmMember !== null}
        onClose={() => setRemoveConfirmMember(null)}
        title="팀원 제거"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', margin: 0, lineHeight: 1.6 }}>
            <strong style={{ color: '#e8e8ee' }}>{removeConfirmMember?.username}</strong>
            ({removeConfirmMember?.email})을(를) 팀에서 제거하시겠습니까?
            <br />
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>이 작업은 되돌릴 수 없습니다.</span>
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              onClick={() => setRemoveConfirmMember(null)}
              disabled={removing}
              style={secondaryBtnStyle}
            >
              취소
            </button>
            <button
              onClick={handleRemoveConfirmed}
              disabled={removing}
              style={{
                padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                background: 'rgba(226,75,75,0.15)', color: '#e24b4b',
                border: '1px solid rgba(226,75,75,0.3)', cursor: 'pointer',
                opacity: removing ? 0.5 : 1,
              }}
            >
              {removing ? '제거 중...' : '제거 확인'}
            </button>
          </div>
        </div>
      </Modal>

      {/* 토스트 */}
      <ToastBanner toast={toast} />
    </div>
  );
}

// ── MemberTableRow ─────────────────────────────────────────────────────────────

function MemberTableRow({
  member,
  isSelf,
  isAdminOrAbove,
  isPending,
  roleDropdownOpen,
  resending,
  onToggleRoleDropdown,
  onRoleChange,
  onRemove,
  onResendInvite,
}: {
  member: Member;
  isSelf: boolean;
  isAdminOrAbove: boolean;
  isPending: boolean;
  roleDropdownOpen: boolean;
  resending: boolean;
  onToggleRoleDropdown: () => void;
  onRoleChange: (role: MemberRole) => void;
  onRemove: () => void;
  onResendInvite: () => void;
}) {
  const roleBadge = ROLE_BADGE[member.role];
  // owner는 역할 변경·제거 불가, 자기 자신도 제거 불가
  const canManage = isAdminOrAbove && !isSelf && member.role !== 'owner';
  const initial = (member.username || member.email).charAt(0).toUpperCase();

  const formattedDate = member.joinedAt
    ? new Date(member.joinedAt).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit' })
    : '-';

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 100px 80px 100px 160px',
      padding: '14px 20px', alignItems: 'center',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
    }}>
      {/* 사용자 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 30, height: 30, borderRadius: '50%',
          background: 'rgba(234,88,12,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700, color: '#ea580c', flexShrink: 0,
        }}>
          {initial}
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8ee' }}>{member.username}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{member.email}</div>
        </div>
      </div>

      {/* 역할 배지 */}
      <span style={{
        fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
        background: roleBadge.bg, color: roleBadge.color,
        display: 'inline-block', width: 'fit-content',
      }}>
        {member.role}
      </span>

      {/* 상태 배지 (pending 여부) */}
      <span style={{
        fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
        background: isPending ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.1)',
        color: isPending ? '#f59e0b' : '#22c55e',
        display: 'inline-block', width: 'fit-content',
      }}>
        {isPending ? '대기 중' : '활성'}
      </span>

      {/* 가입일 */}
      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--font-mono)' }}>
        {formattedDate}
      </span>

      {/* 액션 */}
      {isAdminOrAbove && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
          {/* 초대 재전송 버튼 — pending 멤버에게만 */}
          {canManage && isPending && (
            <button
              onClick={onResendInvite}
              disabled={resending}
              title="초대 재전송"
              style={{
                padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                background: 'rgba(245,158,11,0.08)', color: '#f59e0b',
                border: '1px solid rgba(245,158,11,0.2)', cursor: 'pointer',
                opacity: resending ? 0.5 : 1,
              }}
            >
              {resending ? '전송 중' : '재전송'}
            </button>
          )}

          {/* 역할 변경 드롭다운 — active 멤버이고 관리 가능할 때 */}
          {canManage && !isPending && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={onToggleRoleDropdown}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                  background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)',
                  border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer',
                }}
              >
                역할 <ChevronDown size={11} />
              </button>
              {roleDropdownOpen && (
                <div style={{
                  position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 10,
                  background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 8, overflow: 'hidden', minWidth: 120,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                }}>
                  {ROLE_OPTIONS.map((r) => (
                    <button
                      key={r}
                      onClick={() => onRoleChange(r)}
                      style={{
                        display: 'block', width: '100%', padding: '8px 14px',
                        textAlign: 'left', fontSize: 12, fontWeight: 600,
                        background: r === member.role ? 'rgba(234,88,12,0.1)' : 'none',
                        color: r === member.role ? '#ea580c' : 'rgba(255,255,255,0.6)',
                        border: 'none', cursor: 'pointer',
                      }}
                    >
                      {r === 'admin' ? '관리자' : '멤버'}
                      {r === member.role && (
                        <span style={{ marginLeft: 6, fontSize: 10, color: '#ea580c' }}>✓</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 제거/초대취소 버튼 */}
          {canManage && (
            <button
              onClick={onRemove}
              style={{
                padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                background: 'rgba(226,75,75,0.08)', color: '#e24b4b',
                border: '1px solid rgba(226,75,75,0.2)', cursor: 'pointer',
              }}
            >
              {isPending ? '초대 취소' : '제거'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px',
  borderRadius: 8, fontSize: 13,
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.12)',
  color: '#e8e8ee', outline: 'none', boxSizing: 'border-box',
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
  background: 'rgba(255,255,255,0.05)',
  color: 'rgba(255,255,255,0.5)',
  border: '1px solid rgba(255,255,255,0.1)',
  cursor: 'pointer',
};
