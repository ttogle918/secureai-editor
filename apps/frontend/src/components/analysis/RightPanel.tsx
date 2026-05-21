// components/analysis/RightPanel.tsx
// 에디터 오른쪽 패널 — 취약점 상세 / AI 채팅 / 진행률 / SBOM 탭 전환
// VulnDetailPanel 이 FilterBar 를 내장하므로 여기서 별도 렌더링 불필요
'use client';
import { MessageSquare, ShieldAlert, CheckSquare, Package } from 'lucide-react';
import { useSecureStore } from '@/store/useSecureStore';
import VulnDetailPanel from '@/components/analysis/VulnDetailPanel';
import ChatPanel from '@/components/analysis/ChatPanel';
import { ProgressPanel } from '@/components/ui/ProgressPanel';
import { SbomPage } from '@/components/analysis/SbomPage';

export function RightPanel() {
  const rightTab     = useSecureStore((s) => s.rightTab);
  const setRightTab  = useSecureStore((s) => s.setRightTab);
  const vulns        = useSecureStore((s) => s.vulns);
  const isAnalyzing  = useSecureStore((s) => s.isAnalyzing);
  const progressSteps = useSecureStore((s) => s.progressSteps);
  const selectedPath = useSecureStore((s) => s.selectedPath);
  const fileVulnCount = vulns.filter((v) => v.filePath === selectedPath).length;

  const completedSteps = progressSteps.filter((s) => s.status === 'completed').length;
  const totalSteps     = progressSteps.length;
  const progressLabel  = isAnalyzing && totalSteps > 0
    ? `진행률 ${completedSteps}/${totalSteps}`
    : '진행률';

  const TABS = [
    { id: 'vulns'    as const, label: `취약점 (${fileVulnCount})`, icon: <ShieldAlert   size={12} aria-hidden="true" />, pulsing: false },
    { id: 'chat'     as const, label: 'AI 채팅',                   icon: <MessageSquare size={12} aria-hidden="true" />, pulsing: false },
    { id: 'progress' as const, label: progressLabel,               icon: <CheckSquare   size={12} aria-hidden="true" />, pulsing: isAnalyzing },
    { id: 'sbom'     as const, label: 'SBOM',                      icon: <Package       size={12} aria-hidden="true" />, pulsing: false },
  ] as const;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        height: '100%',
      }}
    >
      {/* Tab headers */}
      <div
        role="tablist"
        aria-label="오른쪽 패널 탭"
        style={{
          display: 'flex',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: '#141414',
          flexShrink: 0,
        }}
      >
        {TABS.map((tab) => {
          const isActive = rightTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              id={`right-tab-${tab.id}`}
              aria-selected={isActive}
              aria-controls={`right-panel-${tab.id}`}
              onClick={() => setRightTab(tab.id)}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '8px 0',
                fontSize: 11,
                fontWeight: 600,
                background: 'none',
                border: 'none',
                borderBottom: isActive ? '1.5px solid #ea580c' : '1.5px solid transparent',
                color: isActive ? '#e8e8ee' : 'rgba(255,255,255,0.28)',
                cursor: 'pointer',
                transition: 'all 0.15s',
                position: 'relative',
              }}
            >
              {tab.icon}
              {tab.label}
              {tab.pulsing && (
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: '#22c55e',
                  animation: 'ssePulse 1.4s cubic-bezier(0.4,0,0.6,1) infinite',
                  flexShrink: 0,
                }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Panel content */}
      {rightTab === 'vulns' && (
        <div
          id="right-panel-vulns"
          role="tabpanel"
          aria-labelledby="right-tab-vulns"
          style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}
        >
          {/* FilterBar 는 VulnDetailPanel 내부에 내장됨 */}
          <VulnDetailPanel />
        </div>
      )}
      {rightTab === 'chat' && (
        <div
          id="right-panel-chat"
          role="tabpanel"
          aria-labelledby="right-tab-chat"
          style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
        >
          <ChatPanel />
        </div>
      )}
      {rightTab === 'progress' && (
        <div
          id="right-panel-progress"
          role="tabpanel"
          aria-labelledby="right-tab-progress"
          style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
        >
          <ProgressPanel />
        </div>
      )}
      {rightTab === 'sbom' && (
        <div
          id="right-panel-sbom"
          role="tabpanel"
          aria-labelledby="right-tab-sbom"
          style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}
        >
          <SbomPage />
        </div>
      )}
    </div>
  );
}
