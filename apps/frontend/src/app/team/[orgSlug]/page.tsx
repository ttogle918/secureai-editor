'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Users, Settings, BarChart2, Trophy, ShieldAlert } from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useAuthStore } from '@/store/useAuthStore';
import { apiClient } from '@/lib/api/client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface OrgDetail {
  id: string;
  name: string;
  slug: string;
  memberCount: number;
  projectCount: number;
  role: 'owner' | 'admin' | 'member';
}

interface OrgUsage {
  totalScans: number;
  totalVulns: number;
  memberCount: number;
  projectCount: number;
}

interface Member {
  userId: string;
  username: string;
  email: string;
  role: 'owner' | 'admin' | 'member';
  status: 'active' | 'pending';
  joinedAt: string | null;
}

interface MemberStat {
  userId: string;
  username: string;
  securityScore: number;
  totalSessions: number;
  rank: number;
}

interface TeamDashboard {
  teamId: string;
  teamName: string;
  members: MemberStat[];
  totalCritical: number;
  totalHigh: number;
  avgMttrHours: number;
  monthlyTokenUsage: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SEVERITY_COLORS: Record<string, string> = {
  Critical: '#e24b4b',
  High: '#ea580c',
  Other: 'rgba(255,255,255,0.12)',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function OrgDashboardPage() {
  const router = useRouter();
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const { user, isInitialized } = useAuthStore();

  const [org, setOrg] = useState<OrgDetail | null>(null);
  const [usage, setUsage] = useState<OrgUsage | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [teamDashboard, setTeamDashboard] = useState<TeamDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isInitialized && !user) router.replace('/login');
  }, [isInitialized, user, router]);

  const isAdminOrAbove = org?.role === 'owner' || org?.role === 'admin';

  const fetchAll = useCallback(async () => {
    if (!orgSlug) return;
    setLoading(true);
    setError('');
    try {
      const [orgRes, membersRes] = await Promise.all([
        apiClient.get<{ data: OrgDetail }>(`/organizations/${orgSlug}`),
        apiClient.get<{ data: Member[] }>(`/organizations/${orgSlug}/members`),
      ]);
      const orgData = orgRes.data;
      setOrg(orgData);
      setMembers(membersRes.data ?? []);

      const isAdmin = orgData.role === 'owner' || orgData.role === 'admin';

      // 사용량 집계 (Admin/Owner만)
      if (isAdmin) {
        try {
          const usageRes = await apiClient.get<{ data: OrgUsage }>(`/organizations/${orgSlug}/usage`);
          setUsage(usageRes.data);
        } catch (err) {
          // 사용량 조회 실패 시 무시 (권한 없음 등)
          console.warn('[TeamPage] 사용량 조회 실패 — 권한 부족 또는 일시적 오류', err);
        }
      }

      // 팀 대시보드 (Gamification + 보안 지표) — org.id 필요
      try {
        const dashRes = await apiClient.get<{ data: TeamDashboard }>(
          `/teams/${orgData.id}/dashboard`
        );
        setTeamDashboard(dashRes.data);
      } catch (err) {
        // 팀 대시보드 조회 실패는 비치명적으로 처리 (대시보드 섹션 미표시)
        console.warn('[TeamPage] 팀 대시보드 조회 실패', err);
      }
    } catch {
      setError('팀 정보를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, [orgSlug]);

  useEffect(() => {
    if (user) fetchAll();
  }, [user, fetchAll]);

  if (!isInitialized || !user) return null;

  if (loading) {
    return (
      <PageShell orgSlug={orgSlug} orgName="...">
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', padding: '40px 0', textAlign: 'center' }}>불러오는 중...</div>
      </PageShell>
    );
  }

  if (error || !org) {
    return (
      <PageShell orgSlug={orgSlug} orgName="">
        <div style={{ fontSize: 13, color: '#e24b4b', padding: '40px 0', textAlign: 'center' }}>{error || '팀을 찾을 수 없습니다.'}</div>
      </PageShell>
    );
  }

  const previewMembers = members.filter((m) => m.status === 'active').slice(0, 5);

  return (
    <PageShell orgSlug={orgSlug} orgName={org.name}>
      {/* 사용량 요약 — Admin/Owner만 */}
      {isAdminOrAbove && usage && (
        <Section icon={<BarChart2 size={16} />} title="사용량 요약">
          <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
            <StatCard label="총 스캔 횟수" value={usage.totalScans.toLocaleString()} highlight />
            <StatCard label="취약점 발견" value={usage.totalVulns.toLocaleString()} />
            <StatCard label="멤버 수" value={usage.memberCount.toString()} />
            <StatCard label="프로젝트 수" value={usage.projectCount.toString()} />
          </div>
        </Section>
      )}

      {/* 팀 보안 대시보드 */}
      {teamDashboard && (
        <>
          {/* 심각도 도넛 차트 */}
          <Section icon={<ShieldAlert size={16} />} title="팀 취약점 현황">
            <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'center' }}>
              <SeverityDonutChart
                totalCritical={teamDashboard.totalCritical}
                totalHigh={teamDashboard.totalHigh}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 140 }}>
                <StatCard label="Critical" value={teamDashboard.totalCritical.toLocaleString()} highlight />
                <StatCard label="High" value={teamDashboard.totalHigh.toLocaleString()} />
                <StatCard label="평균 MTTR" value={`${teamDashboard.avgMttrHours.toFixed(1)}h`} />
                <StatCard label="월간 토큰 사용" value={teamDashboard.monthlyTokenUsage.toLocaleString()} />
              </div>
            </div>
          </Section>

          {/* 멤버 랭킹 테이블 */}
          <Section icon={<Trophy size={16} />} title="팀 멤버 랭킹">
            <MemberRankTable members={teamDashboard.members} />
          </Section>
        </>
      )}

      {/* 멤버 미리보기 */}
      <Section icon={<Users size={16} />} title="최근 멤버">
        {previewMembers.length === 0 ? (
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>멤버가 없습니다.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {previewMembers.map((m) => (
              <MemberRow key={m.userId} member={m} />
            ))}
          </div>
        )}
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <Link
            href={`/team/${orgSlug}/members`}
            style={{
              fontSize: 13, color: '#ea580c', textDecoration: 'none', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            전체 멤버 보기 ({org.memberCount}명) →
          </Link>
        </div>
      </Section>
    </PageShell>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function PageShell({ orgSlug, orgName, children }: { orgSlug: string; orgName: string; children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#0d0d0f', color: '#e8e8ee', fontFamily: 'var(--font-sans, system-ui)' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', gap: 16 }}>
        <Link href="/team" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.4)', textDecoration: 'none', fontSize: 13 }}>
          <ArrowLeft size={15} /> 내 팀 목록
        </Link>
        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.08)' }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: '#e8e8ee', flex: 1 }}>{orgName}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link
            href={`/team/${orgSlug}/members`}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.55)',
              border: '1px solid rgba(255,255,255,0.1)', textDecoration: 'none',
            }}
          >
            <Users size={13} /> 멤버 관리
          </Link>
          <button
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.55)',
              border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer',
            }}
          >
            <Settings size={13} /> 설정
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px' }}>
        {children}
      </div>
    </div>
  );
}

function MemberRow({ member }: { member: Member }) {
  const ROLE_BADGE: Record<string, { bg: string; color: string }> = {
    owner:  { bg: 'rgba(129,140,248,0.15)', color: '#818cf8' },
    admin:  { bg: 'rgba(234,88,12,0.12)',   color: '#ea580c' },
    member: { bg: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' },
  };
  const badge = ROLE_BADGE[member.role] ?? ROLE_BADGE.member;
  const initial = (member.username || member.email).charAt(0).toUpperCase();

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 0',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
    }}>
      {/* 아바타 */}
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: 'rgba(234,88,12,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 700, color: '#ea580c', flexShrink: 0,
      }}>
        {initial}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8ee' }}>{member.username || member.email}</div>
      </div>
      <span style={{
        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
        background: badge.bg, color: badge.color,
      }}>
        {member.role}
      </span>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
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

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  const color = highlight ? '#ea580c' : '#e8e8ee';
  return (
    <div style={{ minWidth: 120 }}>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color, fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em' }}>{value}</div>
    </div>
  );
}

// ── Severity Donut Chart ──────────────────────────────────────────────────────

function SeverityDonutChart({ totalCritical, totalHigh }: { totalCritical: number; totalHigh: number }) {
  const total = totalCritical + totalHigh;
  const other = Math.max(0, 100 - total);

  const data = [
    { name: 'Critical', value: totalCritical },
    { name: 'High', value: totalHigh },
    { name: 'Other', value: other },
  ].filter((d) => d.value > 0);

  if (data.length === 0) {
    data.push({ name: 'Other', value: 1 });
  }

  return (
    <div style={{ width: 200, height: 200, flexShrink: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry) => (
              <Cell
                key={entry.name}
                fill={SEVERITY_COLORS[entry.name] ?? 'rgba(255,255,255,0.12)'}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: '#1a1a1f',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              fontSize: 12,
              color: '#e8e8ee',
            }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Member Rank Table ─────────────────────────────────────────────────────────

const RANK_MEDAL: Record<number, string> = { 1: '1', 2: '2', 3: '3' };
const RANK_COLOR: Record<number, string> = {
  1: '#f59e0b',
  2: '#9ca3af',
  3: '#b45309',
};

function MemberRankTable({ members }: { members: MemberStat[] }) {
  if (members.length === 0) {
    return (
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '20px 0' }}>
        랭킹 데이터가 없습니다.
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <Th>순위</Th>
            <Th>사용자</Th>
            <Th align="right">보안 점수</Th>
            <Th align="right">총 세션</Th>
          </tr>
        </thead>
        <tbody>
          {members.map((stat) => (
            <tr
              key={stat.userId}
              style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
            >
              <Td>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 24, height: 24, borderRadius: '50%',
                  background: stat.rank <= 3 ? `${RANK_COLOR[stat.rank]}22` : 'rgba(255,255,255,0.05)',
                  color: stat.rank <= 3 ? RANK_COLOR[stat.rank] : 'rgba(255,255,255,0.4)',
                  fontSize: 11, fontWeight: 800,
                }}>
                  {RANK_MEDAL[stat.rank] ?? stat.rank}
                </span>
              </Td>
              <Td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: 'rgba(234,88,12,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, color: '#ea580c', flexShrink: 0,
                  }}>
                    {stat.username.charAt(0).toUpperCase()}
                  </div>
                  <span style={{ color: '#e8e8ee', fontWeight: 600 }}>{stat.username}</span>
                </div>
              </Td>
              <Td align="right">
                <ScoreBar score={stat.securityScore} />
              </Td>
              <Td align="right">
                <span style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'var(--font-mono)' }}>
                  {stat.totalSessions.toLocaleString()}
                </span>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th style={{
      padding: '8px 12px', textAlign: align,
      fontSize: 11, color: 'rgba(255,255,255,0.3)',
      fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
    }}>
      {children}
    </th>
  );
}

function Td({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <td style={{ padding: '10px 12px', textAlign: align }}>
      {children}
    </td>
  );
}

function ScoreBar({ score }: { score: number }) {
  const clamped = Math.min(100, Math.max(0, score));
  const color = clamped >= 80 ? '#22c55e' : clamped >= 50 ? '#ea580c' : '#e24b4b';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
      <div style={{
        width: 64, height: 6, borderRadius: 3,
        background: 'rgba(255,255,255,0.08)', overflow: 'hidden',
      }}>
        <div style={{
          width: `${clamped}%`, height: '100%',
          background: color, borderRadius: 3,
          transition: 'width 0.3s ease',
        }} />
      </div>
      <span style={{ color, fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: 12, minWidth: 28 }}>
        {clamped}
      </span>
    </div>
  );
}
