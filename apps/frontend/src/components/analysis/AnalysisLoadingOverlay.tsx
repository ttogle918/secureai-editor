// components/analysis/AnalysisLoadingOverlay.tsx
// 분석 시작 전체화면 오버레이 — 단계별 메시지
// 와이어프레임: secureai-webapp.html LOADING OVERLAY
'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { Shield } from 'lucide-react';
import { useSecureStore } from '@/store/useSecureStore';
import { useEffect, useState } from 'react';

const ANALYSIS_STEPS = [
  '프로젝트 파일 스캔 중...',
  'MCP Filesystem Tool 연결 중...',
  'Claude AI로 코드 분석 중...',
  '취약점 패턴 탐지 중...',
  'API 호출 체인 분석 중...',
  'DAST 샌드박스 실행 중...',
  '결과 집계 중...',
];

export function AnalysisLoadingOverlay() {
  const isAnalyzing = useSecureStore((s) => s.isAnalyzing);
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    if (!isAnalyzing) {
      setStepIdx(0);
      return;
    }
    const interval = setInterval(() => {
      setStepIdx((i) => (i + 1) % ANALYSIS_STEPS.length);
    }, 400);
    return () => clearInterval(interval);
  }, [isAnalyzing]);

  return (
    <AnimatePresence>
      {isAnalyzing && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="status"
          aria-live="polite"
          aria-label="AI 보안 감사 진행 중"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(10px)',
            zIndex: 50,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 24,
          }}
        >
          {/* Spinner with shield icon */}
          <div style={{ position: 'relative', width: 72, height: 72 }}>
            <div
              style={{
                position: 'absolute', inset: 0,
                border: '3px solid rgba(234,88,12,0.18)',
                borderRadius: '50%',
              }}
            />
            <div
              style={{
                position: 'absolute', inset: 0,
                border: '3px solid transparent',
                borderTopColor: '#ea580c',
                borderRadius: '50%',
                animation: 'spin 0.85s linear infinite',
              }}
            />
            <Shield
              size={28}
              color="#f97316"
              aria-hidden="true"
              style={{ position: 'absolute', inset: 0, margin: 'auto' }}
            />
          </div>

          {/* Text */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 19, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>
              AI 보안 감사 진행 중
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 6, fontFamily: 'var(--font-mono)' }}>
              {ANALYSIS_STEPS[stepIdx]}
            </div>
          </div>

          {/* Progress bar */}
          <div
            style={{
              width: 200,
              height: 2,
              background: 'rgba(255,255,255,0.1)',
              borderRadius: 1,
              overflow: 'hidden',
            }}
          >
            <div
              aria-hidden="true"
              style={{
                height: '100%',
                background: '#ea580c',
                borderRadius: 1,
                animation: 'loading-anim 2.8s ease-in-out forwards',
              }}
            />
          </div>

          {/* Step labels */}
          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              justifyContent: 'center',
              maxWidth: 360,
            }}
          >
            {['L1 SAST', 'L2 GitHub', 'L3 DAST'].map((label, i) => (
              <span
                key={label}
                style={{
                  fontSize: 10,
                  padding: '3px 10px',
                  borderRadius: 20,
                  border: '0.5px solid rgba(255,255,255,0.1)',
                  color:      i === 0 ? '#4caf50' : i === 1 ? '#e2a53a' : 'rgba(255,255,255,0.2)',
                  background: i === 0 ? 'rgba(76,175,80,0.08)' : i === 1 ? 'rgba(226,165,58,0.08)' : 'transparent',
                }}
              >
                {label}
              </span>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
