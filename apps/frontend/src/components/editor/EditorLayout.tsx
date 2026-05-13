'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import { useSecureStore } from '@/store/useSecureStore';
import { mockFileContents } from '@/lib/mockData';
import { EditorTabs } from '@/components/editor/EditorTabs';
import DastTerminal from '@/components/analysis/DastTerminal';
import { RightPanel } from '@/components/analysis/RightPanel';
import ResizeHandle from '@/components/ui/ResizeHandle';

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

const MonacoEditor = dynamic(
  () => import('@/components/editor/CodeEditor'),
  { ssr: false },
);

export function EditorLayout() {
  const selectedPath       = useSecureStore((s) => s.selectedPath);
  const setSelectedPath    = useSecureStore((s) => s.setSelectedPath);
  const openTabs           = useSecureStore((s) => s.openTabs);
  const closeTab           = useSecureStore((s) => s.closeTab);
  const rightPanelWidth    = useSecureStore((s) => s.rightPanelWidth);
  const setRightPanelWidth = useSecureStore((s) => s.setRightPanelWidth);
  const terminalHeight     = useSecureStore((s) => s.terminalHeight);
  const setTerminalHeight  = useSecureStore((s) => s.setTerminalHeight);
  const dastLogs           = useSecureStore((s) => s.dastLogs);
  const vulns              = useSecureStore((s) => s.vulns);
  const workspaceId        = useSecureStore((s) => s.workspaceId);

  const [wsFileCache, setWsFileCache] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!workspaceId || !selectedPath || wsFileCache[selectedPath] !== undefined) return;
    fetch(`${BACKEND}/api/workspace/${workspaceId}/file?path=${encodeURIComponent(selectedPath)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.content != null) {
          setWsFileCache((prev) => ({ ...prev, [selectedPath]: data.content }));
        }
      })
      .catch(() => {});
  }, [workspaceId, selectedPath]);

  const onRightResize    = useCallback((d: number) => setRightPanelWidth((prev) => prev - d), [setRightPanelWidth]);
  const onTerminalResize = useCallback((d: number) => setTerminalHeight((prev) => prev - d), [setTerminalHeight]);

  const code = workspaceId
    ? (wsFileCache[selectedPath] ?? '// 파일 로딩 중...')
    : (mockFileContents[selectedPath] ?? '// 파일을 선택하세요');

  const lang = selectedPath.endsWith('.java') ? 'java'
    : /\.(tsx?|jsx?)$/.test(selectedPath) ? 'typescript'
      : selectedPath.endsWith('.py') ? 'python'
        : selectedPath.endsWith('.properties') ? 'ini' : 'plaintext';

  const fileVulns = vulns.filter((v) => v.filePath === selectedPath);

  return (
    <div style={{ display: 'flex', flex: 1, minWidth: 0, minHeight: '1px', overflow: 'hidden', padding: '16px' }}>

      {/* ── 코드 + 터미널 ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>

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
          <DastTerminal logs={dastLogs} />
        </div>
      </div>

      <ResizeHandle onResize={onRightResize} direction="horizontal" />

      {/* ── 오른쪽 패널 ── */}
      <div style={{
        width: rightPanelWidth,
        flexShrink: 0,
        background: '#0f0f0f',
        borderLeft: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <RightPanel />
      </div>
    </div>
  );
}
