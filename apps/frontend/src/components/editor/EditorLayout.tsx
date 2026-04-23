// components/editor/EditorLayout.tsx
// 에디터 3-패널 레이아웃 조합
// (코드 에디터 + DAST 터미널 + 오른쪽 패널)
'use client';
import dynamic from 'next/dynamic';
import { useCallback } from 'react';
import { useSecureStore } from '@/store/useSecureStore';
import { mockFileContents } from '@/lib/mockData';
import { EditorTabs } from '@/components/editor/EditorTabs';
import DastTerminal from '@/components/analysis/DastTerminal';
import { RightPanel } from '@/components/analysis/RightPanel';
import ResizeHandle from '@/components/ui/ResizeHandle';
import type { EditorTab } from '@/components/editor/EditorTabs';
import type { SeverityLevel } from '@/types';

const MonacoEditor = dynamic(
  () => import('@/components/editor/CodeEditor'),
  { ssr: false },
);

// 열린 탭 목록 (고정 mock)
const MOCK_TABS: EditorTab[] = [
  { path: '/src/main/java/UserAuth.java', label: 'UserAuth.java', severity: 'critical' },
  { path: '/src/main/java/AuthService.java', label: 'AuthService.java', severity: 'high' },
  { path: '/src/main/web/LoginPage.tsx', label: 'LoginPage.tsx', severity: 'high' },
];

export function EditorLayout() {
  const selectedPath = useSecureStore((s) => s.selectedPath);
  const setSelectedPath = useSecureStore((s) => s.setSelectedPath);
  const rightPanelWidth = useSecureStore((s) => s.rightPanelWidth);
  const setRightPanelWidth = useSecureStore((s) => s.setRightPanelWidth);
  const terminalHeight = useSecureStore((s) => s.terminalHeight);
  const setTerminalHeight = useSecureStore((s) => s.setTerminalHeight);
  const dastLogs = useSecureStore((s) => s.dastLogs);
  const vulns = useSecureStore((s) => s.vulns);

  const onRightResize = useCallback((d: number) => setRightPanelWidth((prev) => prev - d), [setRightPanelWidth]);
  const onTerminalResize = useCallback((d: number) => setTerminalHeight((prev) => prev - d), [setTerminalHeight]);

  const code = mockFileContents[selectedPath] ?? '// 파일을 선택하세요';
  const lang = selectedPath.endsWith('.java') ? 'java'
    : selectedPath.endsWith('.tsx') || selectedPath.endsWith('.ts') ? 'typescript'
      : selectedPath.endsWith('.properties') ? 'ini' : 'plaintext';
  const fileVulns = vulns.filter((v) => v.filePath === selectedPath);

  return (
    <div style={{ display: 'flex', flex: 1, minWidth: 0, minHeight: '1px', overflow: 'hidden', padding: '16px' }}>

      {/* ── 코드 + 터미널 ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>

        {/* 파일 탭 */}
        <EditorTabs
          tabs={MOCK_TABS}
          activeTab={selectedPath}
          onSelect={setSelectedPath}
        />

        {/* Monaco 에디터 */}
        <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
          <MonacoEditor
            value={code}
            language={lang}
            vulnerabilities={fileVulns}
          />
        </div>

        {/* 터미널 리사이즈 핸들 */}
        <ResizeHandle onResize={onTerminalResize} direction="vertical" />

        {/* DAST 터미널 */}
        <div
          style={{
            height: terminalHeight,
            flexShrink: 0,
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <DastTerminal logs={dastLogs} />
        </div>
      </div>

      {/* 오른쪽 리사이즈 핸들 */}
      <ResizeHandle onResize={onRightResize} direction="horizontal" />

      {/* ── 오른쪽 패널 ── */}
      <div
        style={{
          width: rightPanelWidth,
          flexShrink: 0,
          background: '#0f0f0f',
          borderLeft: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <RightPanel />
      </div>
    </div>
  );
}
