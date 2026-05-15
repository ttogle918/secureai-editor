// components/layout/AppHeader.tsx
// 앱 상단 헤더 — 심각도 필터, 파이프라인 상태, 액션 버튼
'use client';
import { useState } from 'react';
import {
  PanelLeftClose, PanelLeftOpen, ChevronRight,
  FileJson, Play, LayoutDashboard, Code2, Settings, History, Users,
} from 'lucide-react';
import { AnalysisHistoryModal } from '@/components/analysis/AnalysisHistoryModal';
import Link from 'next/link';
import { useSecureStore, type SeverityFilter } from '@/store/useSecureStore';
import { useAuthStore } from '@/store/useAuthStore';
import { SEVERITY_COLORS, SEVERITY_LABELS } from '@/lib/constants/severity';
import { useSse, type SseStatus } from '@/hooks/useSse';
import { useToastStore } from '@/hooks/useToast';
import { useStartAnalysis } from '@/hooks/useStartAnalysis';
import { SseIndicator } from '@/components/ui/SseIndicator';
import { apiClient } from '@/lib/api/client';
import type { Severity, VulnCategory, Vulnerability, PatchSuggestion } from '@/lib/mockData';

const SEV_FILTERS: Array<'critical' | 'high' | 'medium' | 'low'> = ['critical', 'high', 'medium', 'low'];
const VALID_CATS: VulnCategory[] = ['SECURITY', 'CODE_QUALITY'];

// 와이어프레임 색상 — 항상 색상 표시, active 시 솔리드
const SEV_COLORS: Record<'critical' | 'high' | 'medium' | 'low', string> = {
  critical: '#e24b4b',
  high:     '#f59e0b',
  medium:   '#eab308',
  low:      '#22c55e',
};

interface AppHeaderProps {
  onExportJSON?: () => void;
}

export function AppHeader({ onExportJSON }: AppHeaderProps) {
  const { user: authUser } = useAuthStore();
  const projectId          = useSecureStore((s) => s.projectId);
  const sidebarOpen        = useSecureStore((s) => s.sidebarOpen);
  const setSidebarOpen     = useSecureStore((s) => s.setSidebarOpen);
  const viewMode           = useSecureStore((s) => s.viewMode);
  const setViewMode        = useSecureStore((s) => s.setViewMode);
  const selectedPath       = useSecureStore((s) => s.selectedPath);
  const severityFilter     = useSecureStore((s) => s.severityFilter);
  const setSeverityFilter  = useSecureStore((s) => s.setSeverityFilter);
  const vulns              = useSecureStore((s) => s.vulns);
  const setIsAnalyzing     = useSecureStore((s) => s.setIsAnalyzing);
  const sseSessionId        = useSecureStore((s) => s.sseSessionId);
  const addVuln             = useSecureStore((s) => s.addVuln);
  const clearVulns          = useSecureStore((s) => s.clearVulns);
  const setPatches          = useSecureStore((s) => s.setPatches);
  const setLastTokenUsage   = useSecureStore((s) => s.setLastTokenUsage);
  const setRightTab         = useSecureStore((s) => s.setRightTab);
  const addProgressStep    = useSecureStore((s) => s.addProgressStep);
  const addToast           = useToastStore((s) => s.addToast);
  const { startAnalysis, isAnalyzing } = useStartAnalysis();

  // SSE 상태 — 컴포넌트 로컬 상태로 관리
  const [sseStatus, setSseStatus] = useState<SseStatus>('idle');
  const [showHistory, setShowHistory] = useState(false);

  const VALID_SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low'];

  useSse({
    sessionId: sseSessionId,
    onEvent: (event) => {
      if (event.type === 'completed') {
        const sid = event.sessionId;

        // DB에서 실제 취약점 로드 — SSE 페이로드 대신 DB 기준으로 로드해야
        // 캐시 히트 레이스 컨디션 + 합성 ID 불일치 문제를 모두 해결한다.
        apiClient.get<{ data: { content: Array<{
          id: string; filePath: string; lineNumber: number | null;
          vulnType: string; severity: string; category: string | null;
          cwe: string | null; owasp: string | null; description: string | null;
        }> } }>(`/vulnerabilities?sessionId=${sid}&size=500`)
          .then((res) => {
            const items = res.data?.content ?? [];
            clearVulns();
            for (const v of items) {
              const rawSev = (v.severity ?? 'low').toLowerCase() as Severity;
              const severity: Severity = VALID_SEVERITIES.includes(rawSev) ? rawSev : 'low';
              const rawCat = (v.category ?? 'SECURITY') as VulnCategory;
              const category: VulnCategory = VALID_CATS.includes(rawCat) ? rawCat : 'SECURITY';
              const vuln: Vulnerability = {
                id: v.id, type: v.vulnType, severity, category,
                lineStart: v.lineNumber ?? 0, lineEnd: v.lineNumber ?? 0,
                filePath: v.filePath, description: v.description ?? '',
                cweId: v.cwe ?? '', owaspCategory: v.owasp ?? '', status: 'open',
              };
              addVuln(vuln);
            }
          })
          .catch(() => {});

        const totalVulns = event.vuln_count ?? 0;
        const usage = event.token_usage as { input_tokens: number; output_tokens: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number } | undefined;
        if (usage) {
          const inp   = usage.input_tokens;
          const out   = usage.output_tokens;
          const cw    = usage.cache_creation_input_tokens ?? 0;
          const cr    = usage.cache_read_input_tokens ?? 0;
          // claude-haiku-4-5-20251001 pricing (USD per million tokens)
          const costUsd = (inp * 0.80 + out * 4.00 + cw * 1.00 + cr * 0.08) / 1_000_000;
          setLastTokenUsage({
            inputTokens:      inp,
            outputTokens:     out,
            cacheWriteTokens: cw,
            cacheReadTokens:  cr,
            estimatedCostUsd: costUsd,
            modelId:          'claude-haiku-4-5',
          });
          const totalTokens = inp + out + cw + cr;
          addToast(
            `분석 완료 — 취약점 ${totalVulns}개 · ${(totalTokens / 1000).toFixed(1)}k 토큰 · $${costUsd.toFixed(4)}`,
            'info',
          );
        } else {
          addToast(`분석 완료 — 취약점 ${totalVulns}개 발견`, 'info');
        }

        // 패치 제안을 백엔드에서 로드 (patch_node가 저장 완료 후 completed 이벤트 발생)
        apiClient.get<{ data: Array<{
          id: string; vulnId: string | null; filePath: string; vulnType: string;
          originalSnippet: string | null; patchedSnippet: string | null; explanation: string | null;
        }> }>(`/sessions/${sid}/patches`)
          .then((res) => {
            const items = res.data ?? [];
            const patches: PatchSuggestion[] = items.map((p) => ({
              vulnId:       p.vulnId ?? undefined,
              filePath:     p.filePath,
              vulnType:     p.vulnType,
              originalCode: p.originalSnippet ?? '',
              patchedCode:  p.patchedSnippet ?? '',
              explanation:  p.explanation ?? '',
            }));
            setPatches(patches);
          })
          .catch(() => {});

        setRightTab('vulns'); // 완료 시 취약점 탭으로 자동 전환
        setIsAnalyzing(false);
      } else if (event.type === 'progress' && event.node === 'sast' && event.file) {
        // 파일별 SAST 진행률 업데이트
        addProgressStep({
          stepName: 'SAST 분석',
          stepOrder: event.current ?? 0,
          target: event.file,
          status: 'completed',
        });
      } else if (event.type === 'error') {
        addToast(event.message ?? 'SSE 오류가 발생했습니다.', 'error');
        setIsAnalyzing(false);
      }
    },
    onStatusChange: (status) => {
      setSseStatus(status);
      if (status === 'closed' || status === 'auth_error') setIsAnalyzing(false);
    },
  });

  const handleSevFilter = (sev: SeverityFilter) => {
    setSeverityFilter(severityFilter === sev ? 'all' : sev);
  };

  const currentFile =
    viewMode === 'editor'
      ? selectedPath.split('/').pop()
      : 'Security Dashboard';

  return (
    <header
      style={{
        height: '100%',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        background: '#0d0d0f',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 18px',
        flexShrink: 0,
        zIndex: 10,
        gap: 12,
      }}
    >
      {/* ── Left: Sidebar toggle + Path + Pipeline ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          style={{
            background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
            cursor: 'pointer', display: 'flex', padding: 6, borderRadius: 6,
          }}
        >
          {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
          <span style={{ color: '#ea580c' }}>SecureAI</span>
          <ChevronRight size={12} color="rgba(255,255,255,0.2)" />
          <span style={{ color: '#fff' }}>{currentFile}</span>
        </div>

        <div className="header-pipeline-badges">
          {([
            { label: 'SAST',  bg: 'rgba(34,197,94,0.12)',  color: '#22c55e', border: 'rgba(34,197,94,0.35)'  },
            { label: 'DAST',  bg: 'rgba(249,115,22,0.10)', color: '#f97316', border: 'rgba(249,115,22,0.30)' },
            { label: 'PATCH', bg: 'rgba(99,102,241,0.10)', color: '#818cf8', border: 'rgba(99,102,241,0.30)' },
          ] as const).map(({ label, bg, color, border }) => (
            <div key={label} style={{
              fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 10,
              background: bg, color, border: `0.5px solid ${border}`,
            }}>
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* ── Right ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div className="header-sev-filters">
          {/* ALL 버튼 — active 시 흰색 반투명 하이라이트 */}
          <button
            onClick={() => setSeverityFilter('all')}
            style={{
              fontSize: 10, fontWeight: 800, padding: '4px 10px', borderRadius: 4,
              background: severityFilter === 'all' ? 'rgba(255,255,255,0.12)' : 'transparent',
              color: severityFilter === 'all' ? '#e8e8ee' : 'rgba(255,255,255,0.35)',
              border: `1px solid ${severityFilter === 'all' ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.1)'}`,
              cursor: 'pointer',
            }}
          >
            ALL
          </button>
          {/* 심각도 버튼 — 항상 색상 표시 (비활성: 반투명, 활성: 솔리드) */}
          {SEV_FILTERS.map(sev => {
            const active = severityFilter === sev;
            const color = SEV_COLORS[sev];
            return (
              <button
                key={sev}
                onClick={() => handleSevFilter(sev)}
                style={{
                  fontSize: 10, fontWeight: 800, padding: '4px 10px', borderRadius: 4,
                  background: active ? color : `${color}22`,
                  color: active ? '#fff' : color,
                  border: `1px solid ${active ? color : `${color}66`}`,
                  cursor: 'pointer',
                }}
              >
                {sev.toUpperCase()}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => setViewMode(v => v === 'editor' ? 'dashboard' : 'editor')}
          style={{
            fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 6,
            background: '#1a1a1c', color: '#e8e8ee', border: '1px solid #2d2d30',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          {viewMode === 'editor' ? <LayoutDashboard size={14} /> : <Code2 size={14} />}
          {viewMode === 'editor' ? '대시보드' : '에디터'}
        </button>

        {projectId && (
          <button
            onClick={() => setShowHistory(true)}
            title="분석 이력"
            style={{
              fontSize: 11, fontWeight: 700, padding: '6px 10px', borderRadius: 6,
              background: '#1a1a1c', color: 'rgba(255,255,255,0.45)',
              border: '1px solid #2d2d30', cursor: 'pointer',
              display: 'flex', alignItems: 'center',
            }}
          >
            <History size={14} />
          </button>
        )}

        <button
          onClick={startAnalysis}
          disabled={isAnalyzing}
          style={{
            fontSize: 11, fontWeight: 800, padding: '6px 16px', borderRadius: 6,
            background: isAnalyzing ? '#ea580c44' : '#ea580c',
            color: '#fff', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
            boxShadow: isAnalyzing ? 'none' : '0 4px 12px rgba(234,88,12,0.4)',
          }}
        >
          <Play size={14} fill="currentColor" />
          {isAnalyzing ? '분석 중...' : '분석 시작'}
        </button>

        {showHistory && projectId && (
          <AnalysisHistoryModal
            projectId={projectId}
            onClose={() => setShowHistory(false)}
          />
        )}

        {onExportJSON && (
          <button
            onClick={onExportJSON}
            className="header-export-btn"
            style={{
              fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.25)',
              background: 'none', border: 'none', cursor: 'pointer',
              alignItems: 'center', gap: 4, marginLeft: 8,
            }}
          >
            <FileJson size={14} /> Export JSON
          </button>
        )}

        {/* SSE 연결 상태 표시 */}
        <div style={{ marginLeft: 8 }}>
          <SseIndicator
            status={sseStatus}
            isAnalyzing={isAnalyzing}
            hasResults={vulns.length > 0}
          />
        </div>

        {authUser?.isAdmin && (
          <Link
            href="/admin/users"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '5px 10px', borderRadius: 6,
              fontSize: 11, fontWeight: 700,
              color: '#ea580c',
              background: 'rgba(234,88,12,0.10)',
              border: '1px solid rgba(234,88,12,0.25)',
              textDecoration: 'none',
              marginLeft: 4,
            }}
            title="Admin Console"
          >
            Admin
          </Link>
        )}

        <Link
          href="/team"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 32, height: 32, borderRadius: 6,
            color: 'rgba(255,255,255,0.35)',
            background: 'none', border: 'none', cursor: 'pointer',
            transition: 'color 0.15s',
            marginLeft: 4,
          }}
          title="팀"
        >
          <Users size={16} />
        </Link>

        <Link
          href="/settings"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 32, height: 32, borderRadius: 6,
            color: 'rgba(255,255,255,0.35)',
            background: 'none', border: 'none', cursor: 'pointer',
            transition: 'color 0.15s',
            marginLeft: 4,
          }}
          title="설정"
        >
          <Settings size={16} />
        </Link>
      </div>
    </header>
  );
}
