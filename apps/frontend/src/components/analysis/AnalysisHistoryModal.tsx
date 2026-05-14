'use client';
import { useEffect, useState } from 'react';
import { X, Clock, Shield, ChevronRight } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { useSecureStore } from '@/store/useSecureStore';
import type { Severity, VulnCategory, Vulnerability } from '@/lib/mockData';

interface SessionItem {
  id: string;
  status: string;
  totalFiles: number;
  vulnCount: number;
  completedAt: string | null;
  createdAt: string;
}

interface VulnBreakdown {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

const SEV_COLORS = { critical: '#e24b4b', high: '#f59e0b', medium: '#eab308', low: '#22c55e' };

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

interface Props {
  projectId: string;
  onClose: () => void;
}

export function AnalysisHistoryModal({ projectId, onClose }: Props) {
  const [sessions, setSessions]       = useState<SessionItem[]>([]);
  const [breakdowns, setBreakdowns]   = useState<Record<string, VulnBreakdown>>({});
  const [loading, setLoading]         = useState(true);
  const [loadingId, setLoadingId]     = useState<string | null>(null);

  const addVuln    = useSecureStore((s) => s.addVuln);
  const clearVulns = useSecureStore((s) => s.clearVulns);
  const setPatches = useSecureStore((s) => s.setPatches);

  useEffect(() => {
    apiClient.get<{ data: { content: SessionItem[] } }>(
      `/analysis/sessions?projectId=${projectId}&size=20`,
    ).then((res) => {
      const items = (res.data?.content ?? []).filter((s) => s.status === 'completed');
      setSessions(items);

      // 각 세션의 심각도별 취약점 수 조회
      Promise.all(items.map(async (s) => {
        try {
          const vRes = await apiClient.get<{ data: { content: Array<{ severity: string }> } }>(
            `/vulnerabilities?sessionId=${s.id}&size=500`,
          );
          const vulns = vRes.data?.content ?? [];
          const bd: VulnBreakdown = { critical: 0, high: 0, medium: 0, low: 0 };
          for (const v of vulns) {
            const sev = v.severity?.toLowerCase() as keyof VulnBreakdown;
            if (sev in bd) bd[sev]++;
          }
          return [s.id, bd] as const;
        } catch {
          return [s.id, { critical: 0, high: 0, medium: 0, low: 0 }] as const;
        }
      })).then((results) => {
        setBreakdowns(Object.fromEntries(results));
        setLoading(false);
      });
    }).catch(() => setLoading(false));
  }, [projectId]);

  const handleLoad = async (sessionId: string) => {
    setLoadingId(sessionId);
    try {
      const VALID_SEV: Severity[] = ['critical', 'high', 'medium', 'low'];
      const VALID_CAT: VulnCategory[] = ['SECURITY', 'CODE_QUALITY'];

      const [vulnRes, patchRes] = await Promise.all([
        apiClient.get<{ data: { content: Array<{
          id: string; filePath: string; lineNumber: number | null; vulnType: string;
          severity: string; category: string | null; cwe: string | null;
          owasp: string | null; description: string | null;
        }> } }>(`/vulnerabilities?sessionId=${sessionId}&size=500`),
        apiClient.get<{ data: Array<{
          id: string; vulnId: string | null; filePath: string; vulnType: string;
          originalSnippet: string | null; patchedSnippet: string | null; explanation: string | null;
        }> }>(`/sessions/${sessionId}/patches`).catch(() => ({ data: [] as never[] })),
      ]);

      clearVulns();
      for (const v of (vulnRes.data?.content ?? [])) {
        const rawSev = (v.severity ?? 'low').toLowerCase() as Severity;
        const severity: Severity = VALID_SEV.includes(rawSev) ? rawSev : 'low';
        const rawCat = (v.category ?? 'SECURITY') as VulnCategory;
        const category: VulnCategory = VALID_CAT.includes(rawCat) ? rawCat : 'SECURITY';
        const vuln: Vulnerability = {
          id: v.id, type: v.vulnType, severity, category,
          lineStart: v.lineNumber ?? 0, lineEnd: v.lineNumber ?? 0,
          filePath: v.filePath, description: v.description ?? '',
          cweId: v.cwe ?? '', owaspCategory: v.owasp ?? '', status: 'open',
        };
        addVuln(vuln);
      }
      setPatches((patchRes.data ?? []).map((p) => ({
        vulnId: p.vulnId ?? undefined,
        filePath: p.filePath,
        vulnType: p.vulnType,
        originalCode: p.originalSnippet ?? '',
        patchedCode: p.patchedSnippet ?? '',
        explanation: p.explanation ?? '',
      })));
      onClose();
    } catch {
      setLoadingId(null);
    }
  };

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
        width: 560, maxHeight: '80vh', borderRadius: 14,
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
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.35)', display: 'flex' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
              불러오는 중...
            </div>
          ) : sessions.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
              완료된 분석 세션이 없습니다.
            </div>
          ) : (
            sessions.map((s, idx) => {
              const bd = breakdowns[s.id];
              const isFirst = idx === 0;
              return (
                <button
                  key={s.id}
                  onClick={() => handleLoad(s.id)}
                  disabled={loadingId === s.id}
                  style={{
                    width: '100%', padding: '14px 20px',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    background: isFirst ? 'rgba(234,88,12,0.04)' : 'none',
                    border: 'none', cursor: 'pointer', textAlign: 'left',
                    display: 'flex', alignItems: 'center', gap: 12,
                    transition: 'background 0.1s',
                    opacity: loadingId && loadingId !== s.id ? 0.4 : 1,
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = isFirst ? 'rgba(234,88,12,0.04)' : 'none'; }}
                >
                  {/* 아이콘 */}
                  <div style={{
                    width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                    background: isFirst ? 'rgba(234,88,12,0.12)' : 'rgba(255,255,255,0.04)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Shield size={16} color={isFirst ? '#ea580c' : 'rgba(255,255,255,0.3)'} />
                  </div>

                  {/* 정보 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
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
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginLeft: 'auto' }}>
                        {relativeTime(s.completedAt)}
                      </span>
                    </div>

                    {/* 심각도별 배지 */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {bd ? (
                        (['critical', 'high', 'medium', 'low'] as const).map((sev) => (
                          bd[sev] > 0 && (
                            <span key={sev} style={{
                              fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                              background: `${SEV_COLORS[sev]}15`,
                              color: SEV_COLORS[sev],
                              border: `0.5px solid ${SEV_COLORS[sev]}40`,
                            }}>
                              {sev.toUpperCase()} {bd[sev]}
                            </span>
                          )
                        ))
                      ) : (
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                          취약점 {s.vulnCount}개
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
