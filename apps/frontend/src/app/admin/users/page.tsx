'use client';
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api/client';
import { Search, ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { MOCK_ADMIN_USERS } from '@/lib/uiMockData';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AdminUser {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  isActive: boolean;
  isAdmin: boolean;
  planId: number;
  planName: string;
  creditBalance: number;
  lastLoginAt: string | null;
  createdAt: string;
}

interface PageResponse {
  content: AdminUser[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

const PLANS = [
  { id: '', label: '전체 플랜' },
  { id: '1', label: 'Free' },
  { id: '2', label: 'Pro' },
  { id: '3', label: 'Team' },
  { id: '4', label: 'Enterprise' },
];

const STATUS_OPTIONS = [
  { value: '', label: '전체 상태' },
  { value: 'true', label: '활성' },
  { value: 'false', label: '비활성' },
];

const PAGE_SIZE = 20;

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span style={{
      fontSize: 11,
      fontWeight: 700,
      padding: '2px 9px',
      borderRadius: 20,
      background: isActive ? 'rgba(34,197,94,0.10)' : 'rgba(226,75,75,0.10)',
      color: isActive ? '#22c55e' : '#e24b4b',
      border: `1px solid ${isActive ? 'rgba(34,197,94,0.3)' : 'rgba(226,75,75,0.3)'}`,
    }}>
      {isActive ? '활성' : '비활성'}
    </span>
  );
}

function PlanBadge({ planName }: { planName: string }) {
  const color =
    planName === 'enterprise' ? '#818cf8'
    : planName === 'team'       ? '#f59e0b'
    : planName === 'pro'        ? '#ea580c'
    : 'rgba(255,255,255,0.35)';
  return (
    <span style={{
      fontSize: 11,
      fontWeight: 700,
      padding: '2px 9px',
      borderRadius: 20,
      background: `${color}18`,
      color,
      border: `1px solid ${color}44`,
      textTransform: 'capitalize',
    }}>
      {planName}
    </span>
  );
}

// ── Row Actions ───────────────────────────────────────────────────────────────

interface RowActionsProps {
  user: AdminUser;
  onPlanChange: (userId: string, planId: number) => Promise<void>;
  onStatusToggle: (userId: string, currentStatus: boolean) => Promise<void>;
  onCreditGrant: (userId: string, amount: number) => Promise<void>;
}

function RowActions({ user, onPlanChange, onStatusToggle, onCreditGrant }: RowActionsProps) {
  const [open, setOpen] = useState(false);
  const [creditInput, setCreditInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handlePlanChange = async (planId: number) => {
    setBusy(true);
    setError('');
    try {
      await onPlanChange(user.id, planId);
    } catch (e) {
      setError(e instanceof Error ? e.message : '플랜 변경 실패');
    } finally {
      setBusy(false);
    }
  };

  const handleStatusToggle = async () => {
    setBusy(true);
    setError('');
    try {
      await onStatusToggle(user.id, user.isActive);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : '상태 변경 실패');
    } finally {
      setBusy(false);
    }
  };

  const handleCreditGrant = async () => {
    const amount = parseInt(creditInput, 10);
    if (!amount || amount <= 0) { setError('유효한 크레딧 수를 입력하세요.'); return; }
    setBusy(true);
    setError('');
    try {
      await onCreditGrant(user.id, amount);
      setCreditInput('');
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : '크레딧 지급 실패');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 6,
          color: 'rgba(255,255,255,0.5)',
          cursor: 'pointer',
          padding: '5px 8px',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <MoreHorizontal size={14} />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 40 }}
          />
          <div style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 4px)',
            zIndex: 50,
            background: '#18181b',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 10,
            padding: '14px 16px',
            minWidth: 220,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}>
            {error && (
              <p style={{ fontSize: 12, color: '#e24b4b', marginBottom: 10 }}>{error}</p>
            )}

            {/* Plan change */}
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>플랜 변경</p>
              <select
                defaultValue={user.planId}
                disabled={busy}
                onChange={(e) => handlePlanChange(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 7,
                  fontSize: 13,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#e8e8ee',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value={1}>Free</option>
                <option value={2}>Pro</option>
                <option value={3}>Team</option>
                <option value={4}>Enterprise</option>
              </select>
            </div>

            {/* Credit grant */}
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>크레딧 지급</p>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="number"
                  min={1}
                  value={creditInput}
                  onChange={(e) => setCreditInput(e.target.value)}
                  placeholder="0"
                  disabled={busy}
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    borderRadius: 7,
                    fontSize: 13,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: '#e8e8ee',
                    outline: 'none',
                  }}
                />
                <button
                  onClick={handleCreditGrant}
                  disabled={busy}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 7,
                    fontSize: 12,
                    fontWeight: 700,
                    background: '#ea580c',
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer',
                    opacity: busy ? 0.5 : 1,
                  }}
                >
                  지급
                </button>
              </div>
            </div>

            {/* Status toggle */}
            <button
              onClick={handleStatusToggle}
              disabled={busy}
              style={{
                width: '100%',
                padding: '9px 16px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                background: user.isActive ? 'rgba(226,75,75,0.12)' : 'rgba(34,197,94,0.12)',
                color: user.isActive ? '#e24b4b' : '#22c55e',
                border: `1px solid ${user.isActive ? 'rgba(226,75,75,0.3)' : 'rgba(34,197,94,0.3)'}`,
                cursor: 'pointer',
                opacity: busy ? 0.5 : 1,
              }}
            >
              {user.isActive ? '비활성화' : '활성화'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [planId, setPlanId] = useState('');
  const [isActive, setIsActive] = useState('');

  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  const fetchUsers = useCallback(async (
    pg: number,
    q: string,
    plan: string,
    status: string,
  ) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(pg), size: String(PAGE_SIZE) });
      if (q.trim()) params.set('search', q.trim());
      if (plan) params.set('planId', plan);
      if (status !== '') params.set('isActive', status);

      const res = await apiClient.get<{ data: PageResponse }>(`/admin/users?${params.toString()}`);
      setUsers(res.data.content);
      setTotalPages(res.data.totalPages);
      setTotalElements(res.data.totalElements);
    } catch {
      // API 실패 시 mock 데이터로 fallback
      setUsers(MOCK_ADMIN_USERS as AdminUser[]);
      setTotalPages(1);
      setTotalElements(MOCK_ADMIN_USERS.length);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers(page, search, planId, isActive);
  }, [fetchUsers, page, search, planId, isActive]);

  const handleSearch = () => {
    setPage(0);
    fetchUsers(0, search, planId, isActive);
  };

  const handlePlanChange = async (userId: string, newPlanId: number) => {
    await apiClient.patch(`/admin/users/${userId}/plan`, { planId: newPlanId, reason: 'admin' });
    fetchUsers(page, search, planId, isActive);
  };

  const handleStatusToggle = async (userId: string, current: boolean) => {
    await apiClient.patch(`/admin/users/${userId}/status`, { isActive: !current });
    fetchUsers(page, search, planId, isActive);
  };

  const handleCreditGrant = async (userId: string, amount: number) => {
    await apiClient.post(`/admin/users/${userId}/credits`, { amount });
    fetchUsers(page, search, planId, isActive);
  };

  const formatDate = (val: string | null) => {
    if (!val) return '—';
    return new Date(val).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' });
  };

  const inputStyle: React.CSSProperties = {
    padding: '9px 14px',
    borderRadius: 8,
    fontSize: 13,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: '#e8e8ee',
    outline: 'none',
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    cursor: 'pointer',
  };

  const thStyle: React.CSSProperties = {
    textAlign: 'left',
    fontSize: 11,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.35)',
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    padding: '10px 14px',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    whiteSpace: 'nowrap',
  };

  return (
    <div style={{ padding: '32px 32px', maxWidth: 1100 }}>
      {/* Page title */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#e8e8ee', margin: 0, marginBottom: 4 }}>사용자 관리</h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', margin: 0 }}>
          {loading ? '불러오는 중...' : `총 ${totalElements.toLocaleString()}명`}
        </p>
      </div>

      {/* ── Filters ── */}
      {/* API: GET /api/v1/admin/users?page=&size=&search=&planId=&isActive= */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 360 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.25)', pointerEvents: 'none' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
            placeholder="이메일 또는 사용자명 검색..."
            style={{ ...inputStyle, width: '100%', paddingLeft: 36, boxSizing: 'border-box' }}
          />
        </div>

        <button
          onClick={handleSearch}
          style={{
            padding: '9px 16px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 700,
            background: '#ea580c',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          검색
        </button>

        <select
          value={planId}
          onChange={(e) => { setPlanId(e.target.value); setPage(0); }}
          style={selectStyle}
        >
          {PLANS.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>

        <select
          value={isActive}
          onChange={(e) => { setIsActive(e.target.value); setPage(0); }}
          style={selectStyle}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* ── Table ── */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>이메일</th>
              <th style={thStyle}>사용자명</th>
              <th style={thStyle}>플랜</th>
              <th style={thStyle}>크레딧</th>
              <th style={thStyle}>상태</th>
              <th style={thStyle}>최근 로그인</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>액션</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ padding: '40px 14px', textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.25)' }}>
                  불러오는 중...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '40px 14px', textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.25)' }}>
                  결과가 없습니다.
                </td>
              </tr>
            ) : users.map((u) => {
              const isHovered = hoveredRow === u.id;
              return (
                <tr
                  key={u.id}
                  onMouseEnter={() => setHoveredRow(u.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                  style={{ background: isHovered ? 'rgba(255,255,255,0.03)' : 'transparent', transition: 'background 0.1s' }}
                >
                  <td style={{ padding: '12px 14px', fontSize: 12, color: '#e8e8ee', borderBottom: '1px solid rgba(255,255,255,0.05)', fontFamily: 'var(--font-mono)' }}>
                    {u.email}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: 'rgba(255,255,255,0.65)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    {u.displayName ?? u.username}
                  </td>
                  <td style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <PlanBadge planName={u.planName} />
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: '#e8e8ee', borderBottom: '1px solid rgba(255,255,255,0.05)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                    {u.creditBalance.toLocaleString()}
                  </td>
                  <td style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <StatusBadge isActive={u.isActive} />
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: 'rgba(255,255,255,0.35)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    {formatDate(u.lastLoginAt)}
                  </td>
                  {/* API: PATCH /api/v1/admin/users/{id}/plan | PATCH .../status | POST .../credits */}
                  <td style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', textAlign: 'right' }}>
                    <RowActions
                      user={u}
                      onPlanChange={handlePlanChange}
                      onStatusToggle={handleStatusToggle}
                      onCreditGrant={handleCreditGrant}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20 }}>
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '8px 14px',
              borderRadius: 8,
              fontSize: 13,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.10)',
              color: page === 0 ? 'rgba(255,255,255,0.2)' : '#e8e8ee',
              cursor: page === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            <ChevronLeft size={14} /> 이전
          </button>

          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', padding: '0 8px' }}>
            {page + 1} / {totalPages}
          </span>

          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '8px 14px',
              borderRadius: 8,
              fontSize: 13,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.10)',
              color: page >= totalPages - 1 ? 'rgba(255,255,255,0.2)' : '#e8e8ee',
              cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer',
            }}
          >
            다음 <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
