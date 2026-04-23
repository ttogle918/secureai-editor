'use client';
import { useEffect, useRef } from 'react';
import type { editor } from 'monaco-editor';
import type { Vulnerability } from '@/lib/mockData';

interface Props {
  value: string;
  language?: string;
  vulnerabilities: Vulnerability[];
  onMount?: (ed: editor.IStandaloneCodeEditor) => void;
}

// Monaco는 Next.js SSR 환경에서 dynamic import 필요
let MonacoEditor: React.ComponentType<any> | null = null;
if (typeof window !== 'undefined') {
  // 런타임에 로드
}

export default function CodeEditor({ value, language = 'java', vulnerabilities, onMount }: Props) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof import('monaco-editor') | null>(null);

  const applyDecorations = () => {
    const ed = editorRef.current;
    const monaco = monacoRef.current;
    if (!ed || !monaco) return;

    const decorations = vulnerabilities.flatMap((v) => [
      {
        range: new monaco.Range(v.lineStart, 1, v.lineEnd, 1),
        options: {
          isWholeLine: true,
          className: `vuln-${v.severity}-line`,
          glyphMarginClassName: `vuln-${v.severity}-glyph`,
          hoverMessage: { value: `**${v.type}** (${v.severity.toUpperCase()})\n${v.description}` },
        },
      },
    ]);

    ed.deltaDecorations([], decorations);
  };

  useEffect(() => {
    applyDecorations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vulnerabilities, value]);

  // dynamic import를 사용해 SSR 문제 방지
  const [Editor, setEditor] = useState<React.ComponentType<any> | null>(null);

  useEffect(() => {
    import('@monaco-editor/react').then((mod) => {
      setEditor(() => mod.default);
    });
  }, []);

  if (!Editor) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: 'var(--bg-editor)' }}>
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>에디터 로딩 중...</span>
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
        fontSize: 13,
        fontFamily: 'JetBrains Mono, Fira Code, Consolas, monospace',
        lineNumbers: 'on',
        glyphMargin: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        readOnly: false,
        automaticLayout: true,
        padding: { top: 8 },
      }}
      onMount={(ed: editor.IStandaloneCodeEditor, monaco: typeof import('monaco-editor')) => {
        editorRef.current = ed;
        monacoRef.current = monaco;
        applyDecorations();
        onMount?.(ed);
      }}
    />
  );
}

// useState를 import 누락하지 않도록
import { useState } from 'react';
