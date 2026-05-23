// components/ui/SseIndicator.tsx
// 헤더에 삽입할 SSE 연결 상태 표시 컴포넌트
'use client';

import type { SseStatus } from '@/hooks/useSse';

interface SseIndicatorProps {
  status:      SseStatus;
  isAnalyzing: boolean;
  hasResults:  boolean;
}

interface StatusConfig {
  color: string;
  label: string;
  pulse: boolean;
}

function resolveConfig(status: SseStatus, isAnalyzing: boolean, hasResults: boolean): StatusConfig {
  if (status === 'auth_error')                              return { color: '#f04141', label: '인증 오류',   pulse: false };
  if (status === 'connecting' || status === 'reconnecting') return { color: '#f97316', label: '연결 중...',  pulse: true  };
  if (status === 'open' || isAnalyzing)                     return { color: '#22c55e', label: '분석 중',     pulse: true  };
  if (hasResults)                                           return { color: '#60a5fa', label: '분석 완료',   pulse: false };
  return                                                           { color: '#6b7280', label: '분석 대기',   pulse: false };
}

export function SseIndicator({ status, isAnalyzing, hasResults }: SseIndicatorProps) {
  const cfg = resolveConfig(status, isAnalyzing, hasResults);

  return (
    <div
      style={{
        display:     'flex',
        alignItems:  'center',
        gap:         6,
        fontSize:    11,
        color:       'rgba(255,255,255,0.45)',
        userSelect:  'none',
      }}
    >
      {/* 상태 점 */}
      <span
        style={{
          position:     'relative',
          display:      'inline-flex',
          width:        8,
          height:       8,
        }}
      >
        {/* 펄스 링 (pulse === true인 경우에만) */}
        {cfg.pulse && (
          <span
            style={{
              position:        'absolute',
              inset:           0,
              borderRadius:    '50%',
              background:      cfg.color,
              opacity:         0.4,
              animation:       'ssePulse 1.4s cubic-bezier(0.4,0,0.6,1) infinite',
            }}
          />
        )}
        {/* 솔리드 점 */}
        <span
          style={{
            position:    'absolute',
            inset:       0,
            borderRadius:'50%',
            background:  cfg.color,
          }}
        />
      </span>

      {/* 레이블 */}
      <span style={{ color: cfg.color, fontWeight: 600 }}>
        {cfg.label}
      </span>

      {/* 펄스 키프레임 (inline style로 주입) */}
      <style>{`
        @keyframes ssePulse {
          0%, 100% { transform: scale(1);   opacity: 0.4; }
          50%       { transform: scale(2.2); opacity: 0;   }
        }
      `}</style>
    </div>
  );
}
