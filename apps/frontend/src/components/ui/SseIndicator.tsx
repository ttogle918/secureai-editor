// components/ui/SseIndicator.tsx
// 헤더에 삽입할 SSE 연결 상태 표시 컴포넌트
'use client';

import type { SseStatus } from '@/hooks/useSse';

interface SseIndicatorProps {
  status: SseStatus;
}

// ─── status별 렌더 구성 ──────────────────────────────────────
interface StatusConfig {
  color:   string;
  label:   string;
  pulse:   boolean;
}

const STATUS_CONFIG: Record<SseStatus, StatusConfig> = {
  idle:         { color: '#6b7280', label: '분석 대기',   pulse: false },
  closed:       { color: '#6b7280', label: '분석 대기',   pulse: false },
  connecting:   { color: '#f97316', label: '연결 중...',  pulse: true  },
  reconnecting: { color: '#f97316', label: '연결 중...',  pulse: true  },
  open:         { color: '#22c55e', label: '실시간 수신', pulse: true  },
  auth_error:   { color: '#f04141', label: '인증 오류',   pulse: false },
};

export function SseIndicator({ status }: SseIndicatorProps) {
  const cfg = STATUS_CONFIG[status];

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
