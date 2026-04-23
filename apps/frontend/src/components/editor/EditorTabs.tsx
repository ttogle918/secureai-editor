// components/editor/EditorTabs.tsx
// 열린 파일 탭 바 — 취약점 dot 표시
'use client';
import { X } from 'lucide-react';
import { SeverityDot } from '@/components/ui/SeverityDot';
import type { SeverityLevel } from '@/types';

export interface EditorTab {
  path: string;
  label: string;
  severity?: SeverityLevel;  // 최악 심각도
  isActive?: boolean;
}

interface EditorTabsProps {
  tabs: EditorTab[];
  activeTab?: string;
  onSelect: (path: string) => void;
  onClose?: (path: string) => void;
}

export function EditorTabs({ tabs, activeTab, onSelect, onClose }: EditorTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="열린 파일 탭"
      style={{
        display: 'flex',
        alignItems: 'stretch',
        background: '#121214',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        height: 36,
        overflowX: 'auto',
        flexShrink: 0,
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.path === activeTab;
        return (
          <button
            key={tab.path}
            role="tab"
            aria-selected={isActive}
            id={`tab-${tab.path.replace(/\//g, '-')}`}
            onClick={() => onSelect(tab.path)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '0 16px',
              fontSize: 11,
              fontWeight: 500,
              fontFamily: 'var(--font-mono)',
              color: isActive ? '#e8e8ee' : 'rgba(255,255,255,0.25)',
              borderTop: isActive ? '1.5px solid #ea580c' : '1.5px solid transparent',
              borderLeft: 'none',
              borderRight: '1px solid rgba(255,255,255,0.04)',
              borderBottom: 'none',
              background: isActive ? '#1e1e1e' : 'transparent',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              transition: 'all 0.15s ease-out',
            }}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.background = '#111114';
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.background = 'transparent';
            }}
          >
            {tab.severity && (
              <SeverityDot
                level={tab.severity}
                size={5}
                aria-label={`${tab.severity} 심각도 취약점`}
              />
            )}
            {tab.label}
            {onClose && (
              <span
                role="button"
                aria-label={`${tab.label} 탭 닫기`}
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); onClose(tab.path); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onClose(tab.path); } }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginLeft: 2,
                  opacity: 0.4,
                  cursor: 'pointer',
                }}
              >
                <X size={10} aria-hidden="true" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
