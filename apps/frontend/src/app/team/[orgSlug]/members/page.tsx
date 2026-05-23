'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, UserPlus, ChevronDown } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { apiClient } from '@/lib/api/client';
import { Modal } from '@/components/ui/Modal';

// ── Types ─────────────────────────────────────────────────────────────────────

type MemberRole = 'owner' | 'admin' | 'member';
type MemberStatus = 'active' | 'pending';

interface Member {
  userId: string;
  username: string;
  email: string;
  role: MemberRole;
  status: MemberStatus;
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

const STATUS_BADGE: Record<MemberStatus, { bg: string; color: string; label: string }> = {
  active:  { bg: 'rgba(34,197,94,0.1)',   color: '#22c55e', label: '활성' },
  pending: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', label: '대기 중' },
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function MembersPage() {
  const router = useRouter();
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const { user, isInitialized } = useAuthStore();

  const [meta, setMeta] = useState<OrgMeta | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<MemberRole>('member');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState(false);

  const [roleDropdown, setRoleDropdown] = useState<string | null>(null);

  useEffect(() => {
    if (isInitialized && !user) router.replace('/login');
  }, [isInitialized, user, router]);

  const isAdminOrAbove = meta?.role === 'owner' || meta?.role === 'admin';
  const isSelf = (m: Member) => m.userId === user?.id;

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
    } catch {
      setError('멤버 목록을 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, [orgSlug]);

  useEffect(() => {
    if (user) fetchMembers();
  }, [user, fetchMembers]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteError('');
    setInviteSuccess(false);
    try {
      await apiClient.post(`/organizations/${orgSlug}/invite`, {
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      setInviteSuccess(true);
      setInviteEmail('');
      fetchMembers();
      setTimeout(() => {
        setInviteOpen(false);
        setInviteSuccess(false);
      }, 1500);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '초대에 실패했습니다.';
      setInviteError(msg);
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (member: Member, newRole: MemberRole) => {
    setRoleDropdown(null);
    try {
      await apiClient.patch(`/organizations/${orgSlug}/members/${member.userId}/role`, { role: newRole });
      setMembers((prev) => prev.map((m) => m.userId === member.userId ? { ...m, role: newRole } : m));
    } catch {
      // 실패 시 UI 변경 없이 원상복귀 (setMembers 재호출 없음)
    }
  };

  const handleRemove = async (member: Member) => {
    try {
      await apiClient.delete(`/organizations/${orgSlug}/members/${member.userId}`);
      setMembers((prev) => prev.filter((m) => m.userId !== member.userId));
    } catch {
      // 실패 무시
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
        {isAdminOrAbove && (
          <div style={{ marginBottom: 24 }}>
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
            display: 'grid', gridTemplateColumns: '1fr 100px 80px 100px 120px',
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
            <div style={{ padding: '32px 20px', fontSize: 13, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>불러오는 중...</div>
          ) : error ? (
            <div style={{ padding: '32px 20px', fontSize: 13, color: '#e24b4b', textAlign: 'center' }}>{error}</div>
          ) : members.length === 0 ? (
            <div style={{ padding: '32px 20px', fontSize: 13, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>멤버가 없습니다.</div>
          ) : (
            members.map((m) => (
              <MemberTableRow
                key={m.userId}
                member={m}
                isSelf={isSelf(m)}
                isAdminOrAbove={isAdminOrAbove}
                roleDropdownOpen={roleDropdown === m.userId}
                onToggleRoleDropdown={() => setRoleDropdown(roleDropdown === m.userId ? null : m.userId)}
                onRoleChange={(role) => handleRoleChange(m, role)}
                onRemove={() => handleRemove(m)}
              />
            ))
          )}
        </div>
      </div>

      {/* 초대 모달 */}
      <Modal
        isOpen={inviteOpen}
        onClose={() => { setInviteOpen(false); setInviteError(''); setInviteEmail(''); setInviteSuccess(false); }}
        title="팀원 초대"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', display: 'block', marginBottom: 6 }}>이메일 주소</label>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="teammate@example.com"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', display: 'block', marginBottom: 6 }}>역할</label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as MemberRole)}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          {inviteError && <p style={{ fontSize: 12, color: '#e24b4b', margin: 0 }}>{inviteError}</p>}
          {inviteSuccess && <p style={{ fontSize: 12, color: '#22c55e', margin: 0 }}>초대 메일을 발송했습니다.</p>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              onClick={() => { setInviteOpen(false); setInviteError(''); setInviteEmail(''); setInviteSuccess(false); }}
              style={secondaryBtnStyle}
            >
              취소
            </button>
            <button
              onClick={handleInvite}
              disabled={!inviteEmail.trim() || inviting}
              style={{
                padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                background: inviteSuccess ? '#22c55e' : '#ea580c',
                color: '#fff', border: 'none', cursor: 'pointer',
                opacity: !inviteEmail.trim() || inviting ? 0.5 : 1,
              }}
            >
              {inviting ? '발송 중...' : inviteSuccess ? '발송됨' : '초대 보내기'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── MemberTableRow ─────────────────────────────────────────────────────────────

function MemberTableRow({
  member,
  isSelf,
  isAdminOrAbove,
  roleDropdownOpen,
  onToggleRoleDropdown,
  onRoleChange,
  onRemove,
}: {
  member: Member;
  isSelf: boolean;
  isAdminOrAbove: boolean;
  roleDropdownOpen: boolean;
  onToggleRoleDropdown: () => void;
  onRoleChange: (role: MemberRole) => void;
  onRemove: () => void;
}) {
  const roleBadge = ROLE_BADGE[member.role];
  const statusBadge = STATUS_BADGE[member.status];
  const canManage = isAdminOrAbove && !isSelf && member.role !== 'owner';
  const initial = (member.username || member.email).charAt(0).toUpperCase();

  const formattedDate = member.joinedAt
    ? new Date(member.joinedAt).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit' })
    : '-';

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 100px 80px 100px 120px',
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

      {/* 상태 배지 */}
      <span style={{
        fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
        background: statusBadge.bg, color: statusBadge.color,
        display: 'inline-block', width: 'fit-content',
      }}>
        {statusBadge.label}
      </span>

      {/* 가입일 */}
      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--font-mono)' }}>
        {formattedDate}
      </span>

      {/* 액션 */}
      {isAdminOrAbove && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
          {canManage && member.status === 'active' && (
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
                  borderRadius: 8, overflow: 'hidden', minWidth: 100,
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
                      {r}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {canManage && (
            <button
              onClick={onRemove}
              style={{
                padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                background: 'rgba(226,75,75,0.08)', color: '#e24b4b',
                border: '1px solid rgba(226,75,75,0.2)', cursor: 'pointer',
              }}
            >
              {member.status === 'pending' ? '취소' : '제거'}
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
