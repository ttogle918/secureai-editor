// components/layout/AppHeader.tsx
// 앱 상단 헤더 — 심각도 필터, 파이프라인 상태, 액션 버튼
'use client';
import {
  PanelLeftClose, PanelLeftOpen, ChevronRight,
  FileJson, Play, LayoutDashboard, Code2,
} from 'lucide-react';
import { useSecureStore, type SeverityFilter } from '@/store/useSecureStore';
import { SEVERITY_COLORS, SEVERITY_LABELS } from '@/lib/constants/severity';

const SEV_FILTERS: Array<'critical' | 'high' | 'medium' | 'low'> = ['critical', 'high', 'medium', 'low'];

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
  const isAnalyzing        = useSecureStore((s) => s.isAnalyzing);
  const startAnalysis      = useSecureStore((s) => s.startAnalysis);

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

        <div style={{ display: 'flex', gap: 5, marginLeft: 10 }}>
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
        <div style={{ display: 'flex', gap: 4, marginRight: 10 }}>
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
            style={{
              fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.25)',
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4, marginLeft: 8,
            }}
          >
            <FileJson size={14} /> Export JSON
          </button>
        )}
      </div>
    </header>
  );
}
