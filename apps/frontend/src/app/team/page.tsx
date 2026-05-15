'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Users, Plus, ChevronRight } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { apiClient } from '@/lib/api/client';
import { Modal } from '@/components/ui/Modal';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Organization {
  id: string;
  name: string;
  slug: string;
  memberCount: number;
  role: 'owner' | 'admin' | 'member';
}

interface CreateOrgPayload {
  name: string;
  slug: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TeamPage() {
  const router = useRouter();
  const { user, isInitialized } = useAuthStore();

  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [form, setForm] = useState<CreateOrgPayload>({ name: '', slug: '' });

  useEffect(() => {
    if (isInitialized && !user) router.replace('/login');
  }, [isInitialized, user, router]);

  const fetchOrgs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.get<{ data: Organization[] }>('/organizations');
      setOrgs(res.data ?? []);
    } catch {
      setError('팀 목록을 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchOrgs();
  }, [user, fetchOrgs]);

  const handleNameChange = (name: string) => {
    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    setForm({ name, slug });
  };

  const handleCreate = async () => {
    if (!form.name.trim() || !form.slug.trim()) return;
    setCreating(true);
    setCreateError('');
    try {
      await apiClient.post('/organizations', { name: form.name.trim(), slug: form.slug.trim() });
      setModalOpen(false);
      setForm({ name: '', slug: '' });
      fetchOrgs();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '팀 생성에 실패했습니다.';
      setCreateError(msg);
    } finally {
      setCreating(false);
    }
  };

  if (!isInitialized || !user) return null;

  return (
    <div style={{ minHeight: '100vh', background: '#0d0d0f', color: '#e8e8ee', fontFamily: 'var(--font-sans, system-ui)' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', gap: 16 }}>
        <Link href="/editor" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.4)', textDecoration: 'none', fontSize: 13 }}>
          <ArrowLeft size={15} /> 에디터로 돌아가기
        </Link>
        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.08)' }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: '#e8e8ee' }}>내 팀</span>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px' }}>
        <Section icon={<Users size={16} />} title="내 팀 (Organizations)">
          {/* 새 팀 만들기 버튼 */}
          <div style={{ marginBottom: 24 }}>
            <button
              onClick={() => setModalOpen(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                background: '#ea580c', color: '#fff', border: 'none', cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(234,88,12,0.35)',
              }}
            >
              <Plus size={15} /> 새 팀 만들기
            </button>
          </div>

          {loading ? (
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', padding: '20px 0' }}>불러오는 중...</div>
          ) : error ? (
            <div style={{ fontSize: 13, color: '#e24b4b' }}>{error}</div>
          ) : orgs.length === 0 ? (
            <EmptyOrgs onCreate={() => setModalOpen(true)} />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
              {orgs.map((org) => (
                <OrgCard key={org.id} org={org} />
              ))}
            </div>
          )}
        </Section>
      </div>

      {/* 새 팀 만들기 모달 */}
      <Modal isOpen={modalOpen} onClose={() => { setModalOpen(false); setCreateError(''); setForm({ name: '', slug: '' }); }} title="새 팀 만들기">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', display: 'block', marginBottom: 6 }}>팀 이름</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="My Team"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', display: 'block', marginBottom: 6 }}>슬러그 (URL 식별자)</label>
            <input
              type="text"
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
              placeholder="my-team"
              style={inputStyle}
            />
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>/team/{form.slug || 'my-team'}</p>
          </div>
          {createError && <p style={{ fontSize: 12, color: '#e24b4b', margin: 0 }}>{createError}</p>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              onClick={() => { setModalOpen(false); setCreateError(''); setForm({ name: '', slug: '' }); }}
              style={{ ...secondaryBtnStyle }}
            >
              취소
            </button>
            <button
              onClick={handleCreate}
              disabled={!form.name.trim() || !form.slug.trim() || creating}
              style={{
                padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                background: '#ea580c', color: '#fff', border: 'none', cursor: 'pointer',
                opacity: !form.name.trim() || !form.slug.trim() || creating ? 0.5 : 1,
              }}
            >
              {creating ? '생성 중...' : '만들기'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function OrgCard({ org }: { org: Organization }) {
  const ROLE_BADGE: Record<string, { bg: string; color: string }> = {
    owner:  { bg: 'rgba(129,140,248,0.15)', color: '#818cf8' },
    admin:  { bg: 'rgba(234,88,12,0.12)',   color: '#ea580c' },
    member: { bg: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' },
  };
  const badge = ROLE_BADGE[org.role] ?? ROLE_BADGE.member;

  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 12,
      padding: '20px 18px',
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#e8e8ee', marginBottom: 4 }}>{org.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Users size={11} color="rgba(255,255,255,0.3)" />
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{org.memberCount}명</span>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
            background: badge.bg, color: badge.color, marginLeft: 4,
          }}>{org.role}</span>
        </div>
      </div>
      <Link
        href={`/team/${org.slug}`}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 700,
          background: 'rgba(234,88,12,0.1)', color: '#ea580c',
          border: '1px solid rgba(234,88,12,0.25)', textDecoration: 'none',
          transition: 'background 0.15s',
        }}
      >
        입장 <ChevronRight size={13} />
      </Link>
    </div>
  );
}

function EmptyOrgs({ onCreate }: { onCreate: () => void }) {
  return (
    <div style={{ padding: '32px 0', textAlign: 'center' }}>
      <div style={{
        width: 52, height: 52, borderRadius: 14,
        background: 'rgba(234,88,12,0.06)',
        border: '1px dashed rgba(234,88,12,0.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 16px',
      }}>
        <Users size={22} color="rgba(234,88,12,0.5)" />
      </div>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginBottom: 16 }}>
        아직 소속된 팀이 없습니다.<br />새 팀을 만들거나 초대를 기다리세요.
      </div>
      <button onClick={onCreate} style={{
        padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700,
        background: '#ea580c', color: '#fff', border: 'none', cursor: 'pointer',
      }}>
        첫 팀 만들기
      </button>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <span style={{ color: '#ea580c' }}>{icon}</span>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#e8e8ee', margin: 0 }}>{title}</h2>
      </div>
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '24px 20px' }}>
        {children}
      </div>
    </div>
  );
}

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
