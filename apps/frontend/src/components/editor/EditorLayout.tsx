'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect } from 'react';
import { useSecureStore } from '@/store/useSecureStore';
import { EditorTabs } from '@/components/editor/EditorTabs';
import DastTerminal from '@/components/analysis/DastTerminal';
import { RightPanel } from '@/components/analysis/RightPanel';
import { DockedChatPanel } from '@/components/analysis/ChatFAB';
import ResizeHandle from '@/components/ui/ResizeHandle';

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

const MonacoEditor = dynamic(
  () => import('@/components/editor/CodeEditor'),
  { ssr: false },
);

interface EditorLayoutProps {
  chatDocked?: boolean;
}

export function EditorLayout({ chatDocked = false }: EditorLayoutProps) {
  const selectedPath       = useSecureStore((s) => s.selectedPath);
  const setSelectedPath    = useSecureStore((s) => s.setSelectedPath);
  const openTabs           = useSecureStore((s) => s.openTabs);
  const closeTab           = useSecureStore((s) => s.closeTab);
  const rightPanelWidth    = useSecureStore((s) => s.rightPanelWidth);
  const setRightPanelWidth = useSecureStore((s) => s.setRightPanelWidth);
  const terminalHeight     = useSecureStore((s) => s.terminalHeight);
  const setTerminalHeight  = useSecureStore((s) => s.setTerminalHeight);
  const vulns              = useSecureStore((s) => s.vulns);
  const workspaceId        = useSecureStore((s) => s.workspaceId);
  const activeWorkspaceId  = useSecureStore((s) => s.activeWorkspaceId);

  const fileContents   = useSecureStore((s) => s.fileContents);
  const setFileContent = useSecureStore((s) => s.setFileContent);

  // 추가 워크스페이스 파일을 선택하면 activeWorkspaceId가 변경됨
  const effectiveWsId = activeWorkspaceId ?? workspaceId;

  useEffect(() => {
    if (!effectiveWsId || !selectedPath || fileContents[selectedPath] !== undefined) return;
    fetch(`${BACKEND}/api/workspace/${effectiveWsId}/file?path=${encodeURIComponent(selectedPath)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.content != null) setFileContent(selectedPath, data.content);
      })
      .catch(() => {});
  }, [effectiveWsId, selectedPath]);

  const setChatDockMode = useSecureStore((s) => s.setChatDockMode);
  const onRightResize    = useCallback((d: number) => setRightPanelWidth((prev) => prev - d), [setRightPanelWidth]);
  const onTerminalResize = useCallback((d: number) => setTerminalHeight((prev) => prev - d), [setTerminalHeight]);

  const code = fileContents[selectedPath] ?? (selectedPath ? '// 파일 로딩 중...' : '// 파일을 선택하세요');

  const lang = selectedPath.endsWith('.java') ? 'java'
    : /\.(tsx?|jsx?)$/.test(selectedPath) ? 'typescript'
      : selectedPath.endsWith('.py') ? 'python'
        : selectedPath.endsWith('.properties') ? 'ini' : 'plaintext';

  const fileVulns = vulns.filter((v) => v.filePath === selectedPath);

  return (
    <div style={{ display: 'flex', flex: 1, minWidth: 0, minHeight: '1px', overflow: 'hidden', padding: '16px' }}>

      {/* ── 코드 + 터미널 ── */}
      <div className="editor-main" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>

        <EditorTabs
          tabs={openTabs}
          activeTab={selectedPath}
          onSelect={setSelectedPath}
          onClose={closeTab}
        />

        <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
          <MonacoEditor
            value={code}
            language={lang}
            vulnerabilities={fileVulns}
          />
        </div>

        <ResizeHandle onResize={onTerminalResize} direction="vertical" />

        <div style={{ height: terminalHeight, flexShrink: 0, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <DastTerminal />
        </div>
      </div>

      <ResizeHandle onResize={onRightResize} direction="horizontal" />

      {/* ── 오른쪽 패널: 도크 채팅 또는 기본 패널 ── */}
      <div className="editor-right-panel" style={{
        width: rightPanelWidth,
        flexShrink: 0,
        background: '#0f0f0f',
        borderLeft: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {chatDocked
          ? <DockedChatPanel onUndock={() => setChatDockMode(false)} />
          : <RightPanel />}
      </div>
    </div>
  );
}
