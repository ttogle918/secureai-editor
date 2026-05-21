// components/ui/Toast.tsx
// 화면 우하단 고정 Toast 스택 컴포넌트
'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useToastStore, type ToastSeverity } from '@/hooks/useToast';

// ─── severity별 테두리 색상 ──────────────────────────────────
const BORDER_COLOR: Record<ToastSeverity, string> = {
  critical: 'rgba(240,65,65,0.8)',
  high:     '#f97316',
  info:     'rgba(255,255,255,0.2)',
  error:    'rgba(240,65,65,0.8)',
  warning:  '#eab308',
};

const LABEL_COLOR: Record<ToastSeverity, string> = {
  critical: '#f04141',
  high:     '#f97316',
  info:     'rgba(255,255,255,0.6)',
  error:    '#f04141',
  warning:  '#eab308',
};

const SEVERITY_LABEL: Record<ToastSeverity, string> = {
  critical: 'CRITICAL',
  high:     'HIGH',
  info:     'INFO',
  error:    'ERROR',
  warning:  'WARNING',
};

// ─── 컨테이너 위치 (우하단 고정) ─────────────────────────────
const containerStyle: React.CSSProperties = {
  position:      'fixed',
  bottom:        24,
  right:         24,
  display:       'flex',
  flexDirection: 'column',
  gap:           8,
  zIndex:        9999,
  pointerEvents: 'none',
};

// ─── 메인 컴포넌트 ────────────────────────────────────────────
export function ToastContainer() {
  const toasts      = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  return (
    <div style={containerStyle}>
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 80 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 80 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{
              maxWidth:        320,
              background:      '#1a1a1c',
              border:          `1px solid ${BORDER_COLOR[toast.severity]}`,
              borderRadius:    8,
              padding:         '10px 14px',
              display:         'flex',
              alignItems:      'flex-start',
              gap:             10,
              boxShadow:       '0 8px 24px rgba(0,0,0,0.5)',
              pointerEvents:   'auto',
            }}
          >
            {/* severity 레이블 */}
            <span style={{
              fontSize:   9,
              fontWeight: 800,
              color:      LABEL_COLOR[toast.severity],
              marginTop:  2,
              flexShrink: 0,
              letterSpacing: '0.05em',
            }}>
              {SEVERITY_LABEL[toast.severity]}
            </span>

            {/* 메시지 + action */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{
                fontSize:   12,
                color:      'rgba(255,255,255,0.85)',
                lineHeight: 1.5,
                wordBreak:  'break-word',
              }}>
                {toast.message}
              </span>
              {toast.action && (
                <button
                  onClick={() => { toast.action!.onClick(); removeToast(toast.id); }}
                  style={{
                    alignSelf:    'flex-start',
                    background:   LABEL_COLOR[toast.severity],
                    border:       'none',
                    borderRadius: 4,
                    color:        '#0d0d0e',
                    cursor:       'pointer',
                    fontSize:     11,
                    fontWeight:   700,
                    padding:      '3px 8px',
                  }}
                >
                  {toast.action.label}
                </button>
              )}
            </div>

            {/* 닫기 버튼 */}
            <button
              onClick={() => removeToast(toast.id)}
              style={{
                background:  'none',
                border:      'none',
                cursor:      'pointer',
                color:       'rgba(255,255,255,0.35)',
                display:     'flex',
                alignItems:  'center',
                padding:     0,
                flexShrink:  0,
                marginTop:   1,
              }}
              aria-label="닫기"
            >
              <X size={13} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
