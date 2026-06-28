// components/editor/CodeEditor.tsx
// Monaco Editor 래퍼 — JetBrains Mono 적용, 취약점 데코레이션
// UI/UX REVISIONS.md §8 대응
'use client';
import { useState, useEffect, useRef } from 'react';
import type { editor } from 'monaco-editor';
import type { Vulnerability } from '@/lib/mockData';
import { useSecureStore } from '@/store/useSecureStore';

interface CodeEditorProps {
  value: string;
  language?: string;
  vulnerabilities?: Vulnerability[];
  onMount?: (ed: editor.IStandaloneCodeEditor) => void;
}

const VULN_LINE_STYLE: Record<string, { bg: string; border: string }> = {
  critical: { bg: 'rgba(240,65,65,0.06)',  border: '#f04141' },
  high:     { bg: 'rgba(245,158,11,0.06)', border: '#f59e0b' },
  medium:   { bg: 'rgba(234,179,8,0.04)',  border: '#eab308' },
  low:      { bg: 'rgba(34,197,94,0.04)',  border: '#22c55e' },
};

const MARKER_SEVERITY: Record<string, number> = {
  critical: 8, // MarkerSeverity.Error
  high:     4, // MarkerSeverity.Warning
  medium:   2, // MarkerSeverity.Info
  low:      1, // MarkerSeverity.Hint
};

export default function CodeEditor({
  value,
  language = 'java',
  vulnerabilities = [],
  onMount,
}: CodeEditorProps) {
  const revealLine    = useSecureStore((s) => s.revealLine);
  const setRevealLine = useSecureStore((s) => s.setRevealLine);

  const [Editor, setEditor] = useState<React.ComponentType<any> | null>(null);

  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof import('monaco-editor') | null>(null);
  const decorIds  = useRef<string[]>([]);

  // Load Monaco on client only (SSR safe)
  useEffect(() => {
    import('@monaco-editor/react').then((mod) => {
      setEditor(() => mod.default);
    });
  }, []);

  // Apply vulnerability decorations + squiggly markers
  const applyDecorations = () => {
    const ed     = editorRef.current;
    const monaco = monacoRef.current;
    if (!ed || !monaco || !ed.getModel()) return;

    try {
      const model = ed.getModel()!;
      // 취약점 라인이 파일 줄 수를 벗어나면 Monaco가 "Illegal value for lineNumber"를
      // 던지므로 [1, lineCount] 범위로 클램프한다.
      const lineCount = model.getLineCount();
      const clampLine = (n: number) => Math.min(Math.max(1, n || 1), lineCount);

      // 라인 배경 + glyph 점 + overview ruler
      const newDecorations = vulnerabilities.map((v) => ({
        range: new monaco.Range(clampLine(v.lineStart), 1, Math.max(clampLine(v.lineStart), clampLine(v.lineEnd)), 1),
        options: {
          isWholeLine: true,
          className: `vuln-${v.severity}-line`,
          glyphMarginClassName: `vuln-${v.severity}-glyph`,
          overviewRuler: {
            color: VULN_LINE_STYLE[v.severity]?.border ?? '#888',
            position: monaco.editor.OverviewRulerLane.Left,
          },
          hoverMessage: {
            value: `**${v.type}** (${v.severity.toUpperCase()})  \n${v.description}  \n_${v.cweId} · ${v.owaspCategory}_`,
          },
        },
      }));
      decorIds.current = ed.deltaDecorations(decorIds.current, newDecorations);

      // 물결 밑줄 (VS Code 에러/경고 스타일)
      monaco.editor.setModelMarkers(
        model,
        'secureai-vulns',
        vulnerabilities.map((v) => {
          const ls = clampLine(v.lineStart);
          const le = Math.max(ls, clampLine(v.lineEnd));
          return {
            startLineNumber: ls,
            startColumn: 1,
            endLineNumber: le,
            endColumn: model.getLineMaxColumn(le),
            message: `[${v.severity.toUpperCase()}] ${v.type}: ${v.description}`,
            severity: MARKER_SEVERITY[v.severity] ?? 2,
          };
        }),
      );
    } catch (err) {
      console.warn('Monaco decorations update failed (likely disposed):', err);
    }
  };

  useEffect(() => {
    applyDecorations();
    return () => {
      if (editorRef.current && editorRef.current.getModel()) {
        try {
          editorRef.current.deltaDecorations(decorIds.current, []);
          if (monacoRef.current && editorRef.current.getModel()) {
            monacoRef.current.editor.setModelMarkers(editorRef.current.getModel()!, 'secureai-vulns', []);
          }
        } catch (e) { /* ignore */ }
      }
    };
  }, [vulnerabilities, value]);

  // 취약점 클릭 시 해당 라인으로 스크롤
  useEffect(() => {
    if (!revealLine || !editorRef.current) return;
    try {
      editorRef.current.revealLineInCenter(revealLine);
      editorRef.current.setPosition({ lineNumber: revealLine, column: 1 });
    } catch (e) { /* ignore */ }
    setRevealLine(null);
  }, [revealLine]);

  // Loading state
  if (!Editor) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#111114',
        }}
      >
        <span style={{ fontSize: 11, color: '#555560' }}>에디터 초기화 중...</span>
      </div>
    );
  }

  return (
    <Editor
      height="100%"
      language={language}
      value={value}
      theme="vs-dark"
      options={{
        // UI/UX REVISIONS.md §8 — JetBrains Mono 적용
        fontFamily: "'JetBrains Mono', 'Consolas', 'Courier New', monospace",
        fontLigatures: true,
        fontSize: 13,
        lineHeight: 22,
        lineNumbers: 'on',
        glyphMargin: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        readOnly: false,
        automaticLayout: true,
        padding: { top: 10, bottom: 20 },
        renderLineHighlight: 'line',
        cursorStyle: 'line',
        smoothScrolling: true,
      }}
      onMount={(ed: editor.IStandaloneCodeEditor, monaco: typeof import('monaco-editor')) => {
        editorRef.current = ed;
        monacoRef.current = monaco;
        applyDecorations();
        // 파일 전환 후 pending reveal 처리
        const pendingLine = useSecureStore.getState().revealLine;
        if (pendingLine) {
          ed.revealLineInCenter(pendingLine);
          ed.setPosition({ lineNumber: pendingLine, column: 1 });
          useSecureStore.getState().setRevealLine(null);
        }
        onMount?.(ed);
      }}
    />
  );
}
