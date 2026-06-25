'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSecureStore } from '@/store/useSecureStore';
import { EditorTabs } from '@/components/editor/EditorTabs';
import { BottomPanel } from '@/components/editor/BottomPanel';
import { RightPanel } from '@/components/analysis/RightPanel';
import { DockedChatPanel } from '@/components/analysis/ChatFAB';
import ResizeHandle from '@/components/ui/ResizeHandle';

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

// ── 드롭존 임계값 — 단일 상수로 관리 (CSS는 파생) ─────────────
const SPLIT_THRESHOLD = 0.35;
const SPLIT_THRESHOLD_CSS = `${SPLIT_THRESHOLD * 100}%`;

// 드롭존 방향 — 'center'는 분할 없음
type DropZone = 'left' | 'right' | 'top' | 'bottom' | 'center' | null;
// 분할 방향
type SplitDir = 'horizontal' | 'vertical' | null;

/** 파일 경로로부터 언어 문자열 결정 */
function getLang(path: string): string {
  if (path.endsWith('.java')) return 'java';
  if (/\.(tsx?|jsx?)$/.test(path)) return 'typescript';
  if (path.endsWith('.py')) return 'python';
  if (path.endsWith('.properties')) return 'ini';
  return 'plaintext';
}

/** 파일 경로에서 파일명만 추출 */
function getLabel(path: string): string {
  return path.split('/').pop() ?? path;
}

// 드롭존 판별: 마우스 위치가 컨테이너 내에서 어느 존에 해당하는지
function calcDropZone(e: React.DragEvent, container: HTMLElement): DropZone {
  const rect = container.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const w = rect.width;
  const h = rect.height;

  if (x < w * SPLIT_THRESHOLD) return 'left';
  if (x > w * (1 - SPLIT_THRESHOLD)) return 'right';
  if (y < h * SPLIT_THRESHOLD) return 'top';
  if (y > h * (1 - SPLIT_THRESHOLD)) return 'bottom';
  return 'center';
}

// 드롭존 오버레이 스타일 상수
const OVERLAY_BASE: React.CSSProperties = {
  position: 'absolute',
  zIndex: 20,
  pointerEvents: 'none',
  transition: 'background 0.1s',
};

const ZONE_HIGHLIGHT = 'rgba(249,115,22,0.22)';
const ZONE_NORMAL    = 'rgba(249,115,22,0.04)';

// ── 모듈 레벨 컴포넌트 — 렌더 함수 내부 정의 시 매 렌더 새 참조로 Monaco 리마운트 위험 ──
interface SplitPaneHeaderProps {
  filePath: string;
  onClose: () => void;
}

function SplitPaneHeader({ filePath, onClose }: SplitPaneHeaderProps) {
  return (
    <div style={{
      height: 28,
      flexShrink: 0,
      background: 'var(--bg-0)',
      borderBottom: '1px solid var(--hairline)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 10px',
      gap: 6,
    }}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" aria-hidden="true">
        <path d="M13 2H6a2 2 0 0 0-2 2v16h16V9z" />
      </svg>
      <span style={{
        fontSize: 11,
        color: 'var(--text-tertiary)',
        fontFamily: 'var(--font-mono)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        flex: 1,
        minWidth: 0,
      }}>
        {getLabel(filePath)}
      </span>
      <button
        aria-label="분할 패널 닫기"
        onClick={onClose}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-tertiary)',
          cursor: 'pointer',
          fontSize: 14,
          lineHeight: 1,
          padding: '2px 4px',
          borderRadius: 3,
          flexShrink: 0,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; }}
      >
        ×
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────

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
  const fileContents       = useSecureStore((s) => s.fileContents);
  const setFileContent     = useSecureStore((s) => s.setFileContent);
  const bottomPanelOpen    = useSecureStore((s) => s.bottomPanelOpen);
  const setChatDockMode    = useSecureStore((s) => s.setChatDockMode);

  // ── 드래그-분할 로컬 상태 ──────────────────────────────────
  const [draggingTab, setDraggingTab] = useState<string | null>(null);
  const [dragZone,    setDragZone]    = useState<DropZone>(null);
  const [splitFile,   setSplitFile]   = useState<string | null>(null);
  const [splitDir,    setSplitDir]    = useState<SplitDir>(null);
  const codeAreaRef = useRef<HTMLDivElement>(null);

  const effectiveWsId = activeWorkspaceId ?? workspaceId;

  // 기본 에디터 파일 내용 페치
  // fileContents/setFileContent 를 deps에 추가하면 페치 후 state 갱신 → 재실행 무한루프
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!effectiveWsId || !selectedPath || fileContents[selectedPath] !== undefined) return;
    fetch(`${BACKEND}/api/workspace/${effectiveWsId}/file?path=${encodeURIComponent(selectedPath)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.content != null) setFileContent(selectedPath, data.content);
      })
      .catch((e) => { console.error('[editor] primary file fetch failed', e); });
  }, [effectiveWsId, selectedPath]);

  // 분할 패널 파일 내용 페치 — 동일한 이유로 fileContents/setFileContent 제외
  useEffect(() => {
    if (!effectiveWsId || !splitFile || fileContents[splitFile] !== undefined) return;
    fetch(`${BACKEND}/api/workspace/${effectiveWsId}/file?path=${encodeURIComponent(splitFile)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.content != null) setFileContent(splitFile, data.content);
      })
      .catch((e) => { console.error('[editor] split file fetch failed', e); });
  }, [effectiveWsId, splitFile]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const onRightResize    = useCallback((d: number) => setRightPanelWidth((prev) => prev - d), [setRightPanelWidth]);
  const onTerminalResize = useCallback((d: number) => setTerminalHeight((prev) => prev - d), [setTerminalHeight]);

  // ── 기본(primary) 에디터 값/언어/취약점 ──
  const primaryCode  = fileContents[selectedPath] ?? (selectedPath ? '// 파일 로딩 중...' : '// 파일을 선택하세요');
  const primaryLang  = getLang(selectedPath);
  const primaryVulns = vulns.filter((v) => v.filePath === selectedPath);

  // ── 분할(secondary) 에디터 값/언어/취약점 ──
  const splitCode  = splitFile ? (fileContents[splitFile] ?? '// 파일 로딩 중...') : '';
  const splitLang  = splitFile ? getLang(splitFile) : 'plaintext';
  const splitVulns = splitFile ? vulns.filter((v) => v.filePath === splitFile) : [];

  // ── 드래그 핸들러 ─────────────────────────────────────────
  const handleTabDragStart = useCallback((path: string) => {
    setDraggingTab(path);
  }, []);

  const handleTabDragEnd = useCallback(() => {
    setDraggingTab(null);
    setDragZone(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!codeAreaRef.current) return;
    const zone = calcDropZone(e, codeAreaRef.current);
    setDragZone(zone);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    // relatedTarget이 코드영역 자식이면 무시 (자식 간 이동 시 flickering 방지)
    if (codeAreaRef.current?.contains(e.relatedTarget as Node)) return;
    setDragZone(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!draggingTab || !codeAreaRef.current) {
      setDragZone(null);
      setDraggingTab(null);
      return;
    }
    const zone = calcDropZone(e, codeAreaRef.current);
    if (zone !== 'center' && zone !== null) {
      setSplitFile(draggingTab);
      setSplitDir(zone === 'left' || zone === 'right' ? 'horizontal' : 'vertical');
    }
    setDragZone(null);
    setDraggingTab(null);
  }, [draggingTab]);

  const closeSplit = useCallback(() => {
    setSplitFile(null);
    setSplitDir(null);
  }, []);

  // ── 드롭존 오버레이 스타일 계산 ──────────────────────────
  const zoneStyle = (zone: Exclude<DropZone, null | 'center'>): React.CSSProperties => {
    const active = dragZone === zone;
    const base = { ...OVERLAY_BASE, background: active ? ZONE_HIGHLIGHT : ZONE_NORMAL };
    switch (zone) {
      case 'left':   return { ...base, top: 0, left: 0, width: SPLIT_THRESHOLD_CSS, height: '100%', borderRight: `2px solid ${active ? 'var(--orange)' : 'transparent'}` };
      case 'right':  return { ...base, top: 0, right: 0, width: SPLIT_THRESHOLD_CSS, height: '100%', borderLeft: `2px solid ${active ? 'var(--orange)' : 'transparent'}` };
      case 'top':    return { ...base, top: 0, left: 0, width: '100%', height: SPLIT_THRESHOLD_CSS, borderBottom: `2px solid ${active ? 'var(--orange)' : 'transparent'}` };
      case 'bottom': return { ...base, bottom: 0, left: 0, width: '100%', height: SPLIT_THRESHOLD_CSS, borderTop: `2px solid ${active ? 'var(--orange)' : 'transparent'}` };
    }
  };

  // ── 코드 영역 내부: 단일 또는 분할 ──────────────────────
  const isDragging = draggingTab !== null;
  const splitFlexDir: React.CSSProperties['flexDirection'] =
    splitDir === 'horizontal' ? 'row' : 'column';

  return (
    <div style={{ display: 'flex', flex: 1, minWidth: 0, minHeight: '1px', overflow: 'hidden', padding: '8px 16px 16px 16px' }}>

      {/* ── 코드 + 터미널 ── */}
      <div className="editor-main" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>

        <EditorTabs
          tabs={openTabs}
          activeTab={selectedPath}
          onSelect={setSelectedPath}
          onClose={closeTab}
          onDragStart={handleTabDragStart}
          onDragEnd={handleTabDragEnd}
        />

        {/* 드롭 타깃 코드 영역 */}
        <div
          ref={codeAreaRef}
          style={{ flex: 1, overflow: 'hidden', minHeight: 0, position: 'relative', display: 'flex', flexDirection: splitFlexDir }}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onDragLeave={handleDragLeave}
        >
          {/* Primary pane */}
          <div style={{ flex: 1, overflow: 'hidden', minWidth: 0, minHeight: 0 }}>
            <MonacoEditor
              value={primaryCode}
              language={primaryLang}
              vulnerabilities={primaryVulns}
            />
          </div>

          {/* Secondary pane (분할 시) */}
          {splitFile && splitDir && (
            <>
              {/* 분할선 — 시각 힌트 전용, 리사이즈 불가 (50/50 고정) */}
              <div
                style={{
                  flexShrink: 0,
                  width:  splitDir === 'horizontal' ? 4 : '100%',
                  height: splitDir === 'horizontal' ? '100%' : 4,
                  background: 'var(--border)',
                  cursor: 'default',
                  position: 'relative',
                  zIndex: 5,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(249,115,22,0.4)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--border)'; }}
              />
              {/* Secondary panel */}
              <div style={{ flex: 1, overflow: 'hidden', minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <SplitPaneHeader filePath={splitFile} onClose={closeSplit} />
                <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
                  <MonacoEditor
                    value={splitCode}
                    language={splitLang}
                    vulnerabilities={splitVulns}
                  />
                </div>
              </div>
            </>
          )}

          {/* 드래그 중 드롭존 오버레이 (aria-hidden — 마우스 전용 UX) */}
          {isDragging && (
            <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: 15, pointerEvents: 'none' }}>
              <div style={zoneStyle('left')} />
              <div style={zoneStyle('right')} />
              <div style={zoneStyle('top')} />
              <div style={zoneStyle('bottom')} />
              {/* 중앙 힌트 텍스트 */}
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                fontSize: 10,
                color: 'rgba(249,115,22,0.85)',
                fontFamily: 'var(--font-mono)',
                background: 'rgba(0,0,0,0.82)',
                padding: '5px 13px',
                borderRadius: 5,
                whiteSpace: 'nowrap',
                border: '0.5px solid rgba(249,115,22,0.3)',
                pointerEvents: 'none',
              }}>
                ← 좌 / 우 / 상 / 하에 드롭해서 분할
              </div>
            </div>
          )}
        </div>

        {bottomPanelOpen && (
          <>
            <ResizeHandle onResize={onTerminalResize} direction="vertical" />
            <div style={{ height: terminalHeight, flexShrink: 0, borderTop: '1px solid var(--hairline)' }}>
              <BottomPanel />
            </div>
          </>
        )}
      </div>

      <ResizeHandle onResize={onRightResize} direction="horizontal" />

      {/* ── 오른쪽 패널: 도크 채팅 또는 기본 패널 ── */}
      <div className="editor-right-panel" style={{
        width: rightPanelWidth,
        flexShrink: 0,
        background: 'var(--bg-1)',
        borderLeft: '1px solid var(--hairline)',
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
