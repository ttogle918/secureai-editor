'use client';
import React, { useEffect, useRef } from 'react';
import { useSecureStore } from '@/store/useSecureStore';
import { useDastStream } from '@/hooks/useDastStream';

// ── ANSI 컬러 코드 매핑 ─────────────────────────────────────────
const ANSI_COLORS: Record<string, string> = {
  '30': '#4a4a4a',
  '31': '#ff5f5f',
  '32': '#5fff5f',
  '33': '#ffff00',
  '34': '#5f87ff',
  '35': '#ff5fff',
  '36': '#5fffff',
  '37': '#ffffff',
  '0':  '',        // reset
};

// ANSI escape 시퀀스(\x1b[Nm)를 React span 노드 배열로 변환
function parseAnsi(text: string): React.ReactNode[] {
  // \x1b[ ... m 패턴으로 분리 (캡처 그룹 포함 → 구분자 자체도 토큰에 포함)
  const ANSI_RE = /\x1b\[(\d+)m/g;
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let currentColor: string | null = null;
  let match: RegExpExecArray | null;
  let keyIdx = 0;

  while ((match = ANSI_RE.exec(text)) !== null) {
    const before = text.slice(lastIndex, match.index);
    if (before) {
      nodes.push(
        currentColor
          ? <span key={keyIdx++} style={{ color: currentColor }}>{before}</span>
          : <span key={keyIdx++}>{before}</span>,
      );
    }

    const code = match[1];
    if (code === '0') {
      currentColor = null;
    } else {
      currentColor = ANSI_COLORS[code] ?? null;
    }

    lastIndex = match.index + match[0].length;
  }

  // 나머지 텍스트
  const tail = text.slice(lastIndex);
  if (tail) {
    nodes.push(
      currentColor
        ? <span key={keyIdx++} style={{ color: currentColor }}>{tail}</span>
        : <span key={keyIdx++}>{tail}</span>,
    );
  }

  return nodes.length > 0 ? nodes : [<span key={0}>{text}</span>];
}

const LEVEL_PREFIX: Record<string, string> = {
  info:    '[INFO]   ',
  warn:    '[WARN]   ',
  error:   '[ERROR]  ',
  success: '[SUCCESS]',
};

const LEVEL_COLOR: Record<string, string> = {
  info:    'rgba(255,255,255,0.35)',
  warn:    '#facc15',
  error:   '#f87171',
  success: '#4ade80',
};

// ── DastTerminal 컴포넌트 ────────────────────────────────────────
export default function DastTerminal() {
  const dastLogs      = useSecureStore((s) => s.dastLogs);
  const dastSessionId = useSecureStore((s) => s.dastSessionId);
  const bottomRef     = useRef<HTMLDivElement>(null);

  // SSE 스트림 구독
  useDastStream();

  // 신규 로그 추가 시 자동 스크롤
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [dastLogs]);

  const isRunning = dastSessionId !== null;

  return (
    <div className="flex flex-col h-full">
      {/* 로그 출력 영역 */}
      <div
        className="flex-1 overflow-y-auto p-2"
        style={{
          background: '#050810',
          fontFamily: 'var(--font-mono, monospace)',
          minHeight: 0,
        }}
      >
        {dastLogs.length === 0 ? (
          <p className="text-xs p-2" style={{ color: 'rgba(255,255,255,0.45)' }}>
            DAST 분석을 시작하려면 취약점을 선택하세요.
          </p>
        ) : (
          dastLogs.map((log, i) => (
            <div key={i} className="flex gap-2 text-xs leading-relaxed">
              {/* 타임스탬프 */}
              <span
                className="shrink-0"
                style={{ color: 'rgba(255,255,255,0.2)', minWidth: '7ch' }}
              >
                {log.timestamp}
              </span>

              {/* 레벨 접두사 */}
              <span
                className="shrink-0"
                style={{ color: LEVEL_COLOR[log.level] ?? LEVEL_COLOR.info, minWidth: '10ch' }}
              >
                {LEVEL_PREFIX[log.level] ?? '[INFO]   '}
              </span>

              {/* 메시지 — ANSI 파싱 */}
              <span className="break-all" style={{ color: '#d4d4d4' }}>
                {parseAnsi(log.message)}
              </span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
