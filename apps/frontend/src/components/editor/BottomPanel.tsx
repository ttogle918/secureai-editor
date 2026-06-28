'use client';
import React from 'react';
import { useSecureStore, type BottomTab } from '@/store/useSecureStore';
import { useTranslation } from '@/hooks/useTranslation';
import { Terminal, AlertCircle, Cpu, Network, Command, X } from 'lucide-react';
import DastTerminal from '@/components/analysis/DastTerminal';

const SEV_COLOR: Record<string, string> = {
  critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#3b82f6',
};

export function BottomPanel() {
  const bottomPanelTab = useSecureStore((s) => s.bottomPanelTab);
  const setBottomPanelTab = useSecureStore((s) => s.setBottomPanelTab);
  const bottomPanelOpen = useSecureStore((s) => s.bottomPanelOpen);
  const setBottomPanelOpen = useSecureStore((s) => s.setBottomPanelOpen);
  const vulns = useSecureStore((s) => s.vulns);
  const aiLog = useSecureStore((s) => s.aiLog);
  const setSelectedPath = useSecureStore((s) => s.setSelectedPath);
  const setRevealLine = useSecureStore((s) => s.setRevealLine);
  const openTab = useSecureStore((s) => s.openTab);
  const { t } = useTranslation();

  const TABS: { id: BottomTab; label: string; icon: React.ReactNode }[] = [
    { id: 'problems', label: t('bottom_panel.problems'), icon: <AlertCircle size={13} /> },
    { id: 'output',   label: t('bottom_panel.output'), icon: <Terminal size={13} /> },
    { id: 'debug',    label: t('bottom_panel.debug_console'), icon: <Command size={13} /> },
    { id: 'ports',    label: t('bottom_panel.ports'), icon: <Network size={13} /> },
    { id: 'ai_log',   label: t('bottom_panel.ai_log'), icon: <Cpu size={13} /> },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-1)' }}>
      {/* ── 탭 헤더 ── */}
      <div
        className="hide-scrollbar"
        style={{
          display: 'flex',
          alignItems: 'center',
          height: 36,
          borderBottom: '1px solid var(--hairline)',
          background: 'var(--bg-panel)',
          padding: '0 8px',
          flexShrink: 0,
          overflowX: 'auto',
        }}
      >
        <div style={{ display: 'flex', flex: 1, gap: 16 }}>
          {TABS.map((tab) => {
            const isActive = bottomPanelTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setBottomPanelTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  height: 36,
                  padding: '0 4px',
                  background: 'none',
                  border: 'none',
                  borderBottom: isActive ? '1.5px solid var(--orange)' : '1.5px solid transparent',
                  color: isActive ? '#e8e8ee' : 'rgba(255,255,255,0.4)',
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  fontWeight: isActive ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'color 0.2s, border-color 0.2s',
                  position: 'relative',
                }}
              >
                <span style={{ color: isActive ? 'var(--orange)' : 'inherit', display: 'flex' }}>
                  {tab.icon}
                </span>
                {tab.label}

                {/* Problems 배지 */}
                {tab.id === 'problems' && vulns.length > 0 && (
                  <span
                    style={{
                      marginLeft: 4,
                      padding: '2px 6px',
                      borderRadius: 10,
                      background: 'rgba(234,88,12,0.15)',
                      color: 'var(--orange)',
                      fontSize: 9,
                      fontWeight: 700,
                    }}
                  >
                    {vulns.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* 패널 닫기 버튼 */}
        <button
          onClick={() => setBottomPanelOpen(false)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 24,
            height: 24,
            borderRadius: 4,
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.4)',
            cursor: 'pointer',
            flexShrink: 0,
          }}
          title="패널 닫기"
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
        >
          <X size={14} />
        </button>
      </div>

      {/* ── 탭 내용 ── */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {bottomPanelTab === 'output' && <DastTerminal />}
        {bottomPanelTab === 'problems' && (
          vulns.length === 0 ? (
            <div style={{ padding: 16, fontSize: 12, color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-mono)' }}>
              {t('bottom_panel.no_problems')}
            </div>
          ) : (
            <div style={{ height: '100%', overflowY: 'auto', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
              {vulns.map((v) => {
                const sev = (v.severity || 'low').toLowerCase();
                const fileName = v.filePath.split('/').pop() ?? v.filePath;
                return (
                  <div
                    key={v.id}
                    onClick={() => {
                      openTab(v.filePath, fileName);
                      setSelectedPath(v.filePath);
                      setRevealLine(v.lineStart);
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 16px', cursor: 'pointer', borderBottom: '1px solid var(--hairline)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-2)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{ color: SEV_COLOR[sev] ?? 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', fontSize: 10, minWidth: 58 }}>{sev}</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600, flexShrink: 0 }}>{v.type}</span>
                    <span style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}>{fileName}:{v.lineStart}</span>
                    <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{v.description}</span>
                  </div>
                );
              })}
            </div>
          )
        )}
        {bottomPanelTab === 'debug' && (
          <div style={{ padding: 16, fontSize: 12, color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-mono)' }}>
            {t('bottom_panel.start_debug')}
          </div>
        )}
        {bottomPanelTab === 'ports' && (
          <div style={{ padding: 16, fontSize: 12, color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-mono)' }}>
            {t('bottom_panel.no_ports')}
          </div>
        )}
        {bottomPanelTab === 'ai_log' && (
          aiLog.length === 0 ? (
            <div style={{ padding: 16, fontSize: 12, color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-mono)' }}>
              {t('bottom_panel.ai_waiting')}
            </div>
          ) : (
            <div style={{ height: '100%', overflowY: 'auto', padding: '12px 16px', fontSize: 12, lineHeight: 1.6, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
              {aiLog.map((line, i) => (
                <div key={i} style={{ color: line.startsWith('⚠️') ? 'var(--text-primary)' : undefined }}>{line}</div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
