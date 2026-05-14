// components/analysis/AnalysisLoadingOverlay.tsx
// 분석 진행 상태 플로팅 위젯 — 비차단(non-blocking), 우하단 고정
'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { Shield } from 'lucide-react';
import { useSecureStore } from '@/store/useSecureStore';

export function AnalysisLoadingOverlay() {
  const isAnalyzing   = useSecureStore((s) => s.isAnalyzing);
  const progressSteps = useSecureStore((s) => s.progressSteps);

  const currentFile = progressSteps.length > 0
    ? progressSteps[progressSteps.length - 1].target?.split('/').pop() ?? ''
    : '';

  return (
    <AnimatePresence>
      {isAnalyzing && (
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0,  scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.96 }}
          transition={{ duration: 0.18 }}
          role="status"
          aria-live="polite"
          aria-label="SAST 분석 진행 중"
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 50,
            pointerEvents: 'none',
            background: '#111114',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12,
            padding: '14px 18px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            minWidth: 240,
          }}
        >
          {/* 상단: 스피너 + 제목 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ position: 'relative', width: 28, height: 28, flexShrink: 0 }}>
              <div style={{
                position: 'absolute', inset: 0,
                border: '2px solid rgba(234,88,12,0.18)',
                borderRadius: '50%',
              }} />
              <div style={{
                position: 'absolute', inset: 0,
                border: '2px solid transparent',
                borderTopColor: '#ea580c',
                borderRadius: '50%',
                animation: 'spin 0.85s linear infinite',
              }} />
              <Shield
                size={12}
                color="#f97316"
                aria-hidden="true"
                style={{ position: 'absolute', inset: 0, margin: 'auto' }}
              />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#e8e8ee' }}>
                SAST 분석 중
              </div>
              {currentFile && (
                <div style={{
                  fontSize: 10, color: 'rgba(255,255,255,0.35)',
                  fontFamily: 'var(--font-mono)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  maxWidth: 180,
                }}>
                  {currentFile}
                </div>
              )}
            </div>
          </div>

          {/* L1/L2/L3 레이블 */}
          <div style={{ display: 'flex', gap: 6 }}>
            <span style={{
              fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
              background: 'rgba(76,175,80,0.1)', color: '#4caf50',
              border: '0.5px solid rgba(76,175,80,0.3)',
            }}>
              L1 SAST
            </span>
            <span style={{
              fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
              background: 'transparent', color: 'rgba(255,255,255,0.15)',
              border: '0.5px solid rgba(255,255,255,0.08)',
            }}>
              L2 GitHub
            </span>
            <span style={{
              fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
              background: 'transparent', color: 'rgba(255,255,255,0.15)',
              border: '0.5px solid rgba(255,255,255,0.08)',
            }}>
              L3 DAST
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
