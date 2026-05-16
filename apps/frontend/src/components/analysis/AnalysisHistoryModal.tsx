'use client';
import { useEffect, useState } from 'react';
import { X, Clock, Shield, ChevronRight, Layers } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { useSecureStore } from '@/store/useSecureStore';
import { useToastStore } from '@/hooks/useToast';
import type { Severity, VulnCategory, Vulnerability } from '@/lib/mockData';

interface SessionItem {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'error' | string;
  totalFiles: number;
  vulnCount: number;
  completedAt: string | null;
  createdAt: string;
  projectId: string;
  projectName: string;
}

interface VulnBreakdown { critical: number; high: number; medium: number; low: number }

const SEV_COLORS = { critical: '#e24b4b', high: '#f59e0b', medium: '#eab308', low: '#22c55e' };

const VALID_SEV: Severity[] = ['critical', 'high', 'medium', 'low'];
const VALID_CAT: VulnCategory[] = ['SECURITY', 'CODE_QUALITY'];

function relativeTime(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return '방금 전';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

interface Props { onClose: () => void }

export function AnalysisHistoryModal({ onClose }: Props) {
  const [sessions, setSessions]       = useState<SessionItem[]>([]);
  const [breakdowns, setBreakdowns]   = useState<Record<string, VulnBreakdown>>({});
  const [loading, setLoading]         = useState(true);
  const [loadingId, setLoadingId]     = useState<string | null>(null);

  const workspaceProjects       = useSecureStore((s) => s.workspaceProjects);
  const currentProjectId        = useSecureStore((s) => s.projectId);
  const switchProjectFromHistory = useSecureStore((s) => s.switchProjectFromHistory);
  const setProjectId             = useSecureStore((s) => s.setProjectId);
  const addVuln                  = useSecureStore((s) => s.addVuln);
  const clearVulns               = useSecureStore((s) => s.clearVulns);
  const setPatches               = useSecureStore((s) => s.setPatches);
  const addToast                 = useToastStore((s) => s.addToast);

  useEffect(() => {
    if (workspaceProjects.length === 0) { setLoading(false); return; }

    async function loadAll() {
      const perProject = await Promise.all(
        workspaceProjects.map(async (p) => {
          try {
            // size=100으로 충분한 이력 조회 (completed 필터 제거 → 모든 분석 표시)
            const res = await apiClient.get<{ data: { content: Array<{
              id: string; status: string; totalFiles: number;
              vulnCount: number; completedAt: string | null; createdAt: string;
            }> } }>(`/analysis/sessions?projectId=${p.id}&size=100`);
            return (res.data?.content ?? [])
              .map((s) => ({ ...s, projectId: p.id, projectName: p.name }));
          } catch {
            return [];
          }
        }),
      );

      // completed 우선, 나머지는 createdAt 역순
      const merged = perProject
        .flat()
        .sort((a, b) => {
          if (a.status === 'completed' && b.status !== 'completed') return -1;
          if (a.status !== 'completed' && b.status === 'completed') return 1;
          return (b.completedAt ?? b.createdAt).localeCompare(a.completedAt ?? a.createdAt);
        });
      setSessions(merged);
      // breakdown은 세션 로드 시에만 개별 조회 (모달 열 때 일괄 조회 → rate limit 초과 방지)
      setLoading(false);
    }

    loadAll();
  }, [workspaceProjects]);

  const handleLoad = async (session: SessionItem) => {
    setLoadingId(session.id);
    try {
      const [vulnRes, patchRes] = await Promise.all([
        apiClient.get<{ data: { content: Array<{
          id: string; filePath: string; lineNumber: number | null; vulnType: string;
          severity: string; category: string | null; cwe: string | null;
          owasp: string | null; description: string | null;
        }> } }>(`/vulnerabilities?sessionId=${session.id}&size=500`),
        apiClient.get<{ data: Array<{
          id: string; vulnId: string | null; filePath: string; vulnType: string;
          originalSnippet: string | null; patchedSnippet: string | null; explanation: string | null;
        }> }>(`/sessions/${session.id}/patches`).catch(() => ({ data: [] as never[] })),
      ]);

      // 다른 프로젝트 세션이면 switchProjectFromHistory로 자동 재로드 억제
      if (session.projectId !== currentProjectId) {
        switchProjectFromHistory(session.projectId, session.id);
      }

      clearVulns();
      for (const v of (vulnRes.data?.content ?? [])) {
        const rawSev = (v.severity ?? 'low').toLowerCase() as Severity;
        const severity: Severity = VALID_SEV.includes(rawSev) ? rawSev : 'low';
        const rawCat = (v.category ?? 'SECURITY') as VulnCategory;
        const category: VulnCategory = VALID_CAT.includes(rawCat) ? rawCat : 'SECURITY';
        addVuln({
          id: v.id, type: v.vulnType, severity, category,
          lineStart: v.lineNumber ?? 0, lineEnd: v.lineNumber ?? 0,
          filePath: v.filePath, description: v.description ?? '',
          cweId: v.cwe ?? '', owaspCategory: v.owasp ?? '', status: 'open',
        } as Vulnerability);
      }
      setPatches((patchRes.data ?? []).map((p) => ({
        vulnId: p.vulnId ?? undefined,
        filePath: p.filePath, vulnType: p.vulnType,
        originalCode: p.originalSnippet ?? '',
        patchedCode: p.patchedSnippet ?? '',
        explanation: p.explanation ?? '',
      })));

      // breakdown 세트 — 로드한 취약점 기반으로 계산 (별도 API 호출 없음)
      const bd: VulnBreakdown = { critical: 0, high: 0, medium: 0, low: 0 };
      for (const v of (vulnRes.data?.content ?? [])) {
        const sev = (v.severity ?? '').toLowerCase() as keyof VulnBreakdown;
        if (sev in bd) bd[sev]++;
      }
      setBreakdowns((prev) => ({ ...prev, [session.id]: bd }));

      onClose();
    } catch (err) {
      setLoadingId(null);
      const isRateLimit = err instanceof Error && err.message.includes('429');
      addToast(
        isRateLimit ? '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' : '분석 결과 로드에 실패했습니다.',
        'error',
      );
    }
  };

  const multiProject = workspaceProjects.length > 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="분석 이력"
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: 580, maxHeight: '80vh', borderRadius: 14,
        background: '#111114', border: '1px solid rgba(255,255,255,0.1)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={15} color="#ea580c" />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#e8e8ee' }}>분석 이력</span>
            {multiProject && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                background: 'rgba(129,140,248,0.12)', color: '#818cf8',
                border: '0.5px solid rgba(129,140,248,0.3)',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <Layers size={10} /> 전체 프로젝트
              </span>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.35)', display: 'flex' }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>불러오는 중...</div>
          ) : sessions.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>분석 이력이 없습니다.</div>
          ) : (
            sessions.map((s, idx) => {
              const bd = breakdowns[s.id];
              const isCompleted = s.status === 'completed';
              const isFirst = idx === 0 && isCompleted;
              const isCurrent = s.projectId === currentProjectId;
              const canLoad = isCompleted;

              const statusBadge: { label: string; color: string; bg: string } | null =
                s.status === 'running'  ? { label: '분석 중',  color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' }
                : s.status === 'pending'  ? { label: '대기 중',  color: '#a3a3a3', bg: 'rgba(163,163,163,0.1)' }
                : s.status === 'error'    ? { label: '오류',     color: '#f87171', bg: 'rgba(248,113,113,0.12)' }
                : null;

              return (
                <button
                  key={s.id}
                  onClick={() => canLoad && handleLoad(s)}
                  disabled={loadingId === s.id || !canLoad}
                  style={{
                    width: '100%', padding: '14px 20px',
                    background: isFirst ? 'rgba(234,88,12,0.04)' : 'none',
                    border: 'none',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    cursor: canLoad ? 'pointer' : 'default', textAlign: 'left',
                    display: 'flex', alignItems: 'center', gap: 12,
                    opacity: (loadingId && loadingId !== s.id) || !canLoad ? 0.5 : 1,
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => { if (canLoad) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = isFirst ? 'rgba(234,88,12,0.04)' : 'none'; }}
                >
                  {/* 아이콘 */}
                  <div style={{
                    width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                    background: isFirst ? 'rgba(234,88,12,0.12)' : s.status === 'error' ? 'rgba(248,113,113,0.1)' : 'rgba(255,255,255,0.04)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Shield size={16} color={isFirst ? '#ea580c' : s.status === 'error' ? '#f87171' : 'rgba(255,255,255,0.3)'} />
                  </div>

                  {/* 정보 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, flexWrap: 'wrap' }}>
                      {/* 프로젝트 배지 (멀티 프로젝트 모드에서만) */}
                      {multiProject && (
                        <span style={{
                          fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 3,
                          background: isCurrent ? 'rgba(249,115,22,0.12)' : 'rgba(255,255,255,0.06)',
                          color: isCurrent ? '#f97316' : 'rgba(255,255,255,0.35)',
                          border: `0.5px solid ${isCurrent ? 'rgba(249,115,22,0.3)' : 'rgba(255,255,255,0.12)'}`,
                          maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {s.projectName}
                        </span>
                      )}
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#e8e8ee' }}>
                        {formatDate(s.completedAt)}
                      </span>
                      {isFirst && (
                        <span style={{
                          fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 3,
                          background: 'rgba(234,88,12,0.2)', color: '#ea580c',
                        }}>
                          최신
                        </span>
                      )}
                      {/* 진행 중 / 오류 상태 배지 */}
                      {statusBadge && (
                        <span style={{
                          fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 3,
                          background: statusBadge.bg, color: statusBadge.color,
                        }}>
                          {statusBadge.label}
                        </span>
                      )}
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginLeft: 'auto' }}>
                        {relativeTime(s.completedAt ?? s.createdAt)}
                      </span>
                    </div>

                    {/* 심각도별 배지 (completed만) */}
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {isCompleted ? (
                        bd ? (
                          (['critical', 'high', 'medium', 'low'] as const).map((sev) =>
                            bd[sev] > 0 && (
                              <span key={sev} style={{
                                fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                                background: `${SEV_COLORS[sev]}15`, color: SEV_COLORS[sev],
                                border: `0.5px solid ${SEV_COLORS[sev]}40`,
                              }}>
                                {sev.toUpperCase()} {bd[sev]}
                              </span>
                            )
                          )
                        ) : (
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>취약점 {s.vulnCount}개</span>
                        )
                      ) : (
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
                          {s.status === 'running' ? '분석이 진행 중입니다...' : s.status === 'error' ? '분석 중 오류가 발생했습니다' : '분석 대기 중'}
                        </span>
                      )}
                    </div>
                  </div>

                  {loadingId === s.id ? (
                    <span style={{ fontSize: 11, color: '#ea580c', flexShrink: 0 }}>로드 중...</span>
                  ) : (
                    <ChevronRight size={14} color="rgba(255,255,255,0.2)" style={{ flexShrink: 0 }} />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
