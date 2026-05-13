// components/layout/AppHeader.tsx
// 앱 상단 헤더 — 심각도 필터, 파이프라인 상태, 액션 버튼
'use client';
import { useState } from 'react';
import {
  PanelLeftClose, PanelLeftOpen, ChevronRight,
  FileJson, Play, LayoutDashboard, Code2, Settings,
} from 'lucide-react';
import Link from 'next/link';
import { useSecureStore, type SeverityFilter } from '@/store/useSecureStore';
import { SEVERITY_COLORS, SEVERITY_LABELS } from '@/lib/constants/severity';
import { useSse, type SseStatus } from '@/hooks/useSse';
import { useToastStore } from '@/hooks/useToast';
import { useStartAnalysis } from '@/hooks/useStartAnalysis';
import { SseIndicator } from '@/components/ui/SseIndicator';
import type { Severity, VulnCategory, Vulnerability } from '@/lib/mockData';

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
  const sidebarOpen        = useSecureStore((s) => s.sidebarOpen);
  const setSidebarOpen     = useSecureStore((s) => s.setSidebarOpen);
  const viewMode           = useSecureStore((s) => s.viewMode);
  const setViewMode        = useSecureStore((s) => s.setViewMode);
  const selectedPath       = useSecureStore((s) => s.selectedPath);
  const severityFilter     = useSecureStore((s) => s.severityFilter);
  const setSeverityFilter  = useSecureStore((s) => s.setSeverityFilter);
  const vulns              = useSecureStore((s) => s.vulns);
  const setIsAnalyzing     = useSecureStore((s) => s.setIsAnalyzing);
  const sseSessionId       = useSecureStore((s) => s.sseSessionId);
  const addVuln            = useSecureStore((s) => s.addVuln);
  const addProgressStep    = useSecureStore((s) => s.addProgressStep);
  const addToast           = useToastStore((s) => s.addToast);
  const { startAnalysis, isAnalyzing } = useStartAnalysis();

  // SSE 상태 — 컴포넌트 로컬 상태로 관리
  const [sseStatus, setSseStatus] = useState<SseStatus>('idle');

  const VALID_SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low'];

  useSse({
    sessionId: sseSessionId,
    onEvent: (event) => {
      if (event.type === 'completed') {
        // 분석 완료 — results 배열에서 취약점을 스토어에 적재
        let totalVulns = 0;
        for (const fileResult of (event.results ?? [])) {
          for (const v of fileResult.vulnerabilities) {
            const rawSev = (v.severity ?? 'low').toLowerCase() as Severity;
            const severity: Severity = VALID_SEVERITIES.includes(rawSev) ? rawSev : 'low';
            const rawCat = (v.category ?? 'SECURITY') as VulnCategory;
            const category: VulnCategory = VALID_CATS.includes(rawCat) ? rawCat : 'SECURITY';
            const vuln: Vulnerability = {
              id:            `sse-${fileResult.file}-${v.line ?? 0}-${totalVulns}`,
              type:          v.type ?? 'Unknown',
              severity,
              category,
              lineStart:     v.line ?? 0,
              lineEnd:       v.line ?? 0,
              filePath:      fileResult.file,
              description:   v.description ?? '',
              cweId:         v.cwe ?? '',
              owaspCategory: v.owasp ?? '',
              status:        'open',
            };
            addVuln(vuln);
            totalVulns++;
          }
        }
        const usage = event.token_usage as { input_tokens: number; output_tokens: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number } | undefined;
        const tokenSuffix = usage
          ? ` · ${((usage.input_tokens + usage.output_tokens) / 1000).toFixed(1)}k 토큰`
          : '';
        addToast(`분석 완료 — 취약점 ${totalVulns}개 발견${tokenSuffix}`, 'info');
        if (usage) {
          const cacheWrite = usage.cache_creation_input_tokens ?? 0;
          const cacheRead  = usage.cache_read_input_tokens ?? 0;
          const totalTokens = usage.input_tokens + usage.output_tokens;
          addToast(
            `토큰 상세 — 입력 ${usage.input_tokens.toLocaleString()} / 출력 ${usage.output_tokens.toLocaleString()} / 캐시쓰기 ${cacheWrite.toLocaleString()} / 캐시읽기 ${cacheRead.toLocaleString()} (총 ${totalTokens.toLocaleString()})`,
            'info',
          );
        }
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
          <SseIndicator status={sseStatus} />
        </div>

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
