'use client';
import { useEffect, useRef } from 'react';
import type { DastLog } from '@/lib/mockData';

const levelColor: Record<DastLog['level'], string> = {
  info:    'text-gray-400',
  warn:    'text-yellow-400',
  error:   'text-red-400',
  success: 'text-green-400',
};

const levelPrefix: Record<DastLog['level'], string> = {
  info:    '[INFO]   ',
  warn:    '[WARN]   ',
  error:   '[EXPLOIT]',
  success: '[PATCH]  ',
};

interface Props {
  logs: DastLog[];
}

export default function DastTerminal({ logs }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="flex flex-col h-full">
      {/* 탭 헤더 */}
      <div className="flex border-b shrink-0" style={{ borderColor: 'var(--border)', background: 'var(--bg-panel)' }}>
        <div className="editor-tab active">DAST 터미널</div>
        <div className="editor-tab">로그</div>
      </div>

      {/* 로그 출력 */}
      <div
        className="flex-1 overflow-y-auto p-2"
        style={{ background: '#0d0d0d', fontFamily: 'var(--font-mono, monospace)' }}
      >
        {logs.length === 0 ? (
          <p className="text-xs p-2" style={{ color: 'var(--text-tertiary)' }}>
            DAST 분석을 시작하려면 취약점을 선택하세요.
          </p>
        ) : (
          logs.map((log, i) => (
            <div key={i} className="flex gap-2 text-xs leading-relaxed">
              <span style={{ color: 'var(--text-tertiary)' }}>{log.timestamp}</span>
              <span className={levelColor[log.level]}>{levelPrefix[log.level]}</span>
              <span style={{ color: log.level === 'error' ? 'var(--critical)' : log.level === 'success' ? 'var(--success)' : 'var(--text-secondary)' }}>
                {log.message}
              </span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
