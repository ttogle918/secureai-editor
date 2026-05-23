// components/analysis/CallChainView.tsx
// API 호출 체인 수평 노드 시각화
// - callChain 있으면 수평 노드 체인 렌더링
// - 없으면 filePath 단일 노드
// - 취약 노드(isVulnerable)는 빨간 글로우 처리
'use client';
import { useSecureStore } from '@/store/useSecureStore';
import type { CallChainStep, Vulnerability } from '@/lib/mockData';

const LAYER_COLOR: Record<string, string> = {
  Frontend:   '#378ADD',
  Controller: '#7F77DD',
  Service:    '#1D9E75',
  Repository: '#E24B4A',
  Config:     '#BA7517',
};

interface ChainNodeProps {
  step: CallChainStep;
  isLast: boolean;
}

function ChainNode({ step, isLast }: ChainNodeProps) {
  const setSelectedPath = useSecureStore((s) => s.setSelectedPath);
  const setRevealLine   = useSecureStore((s) => s.setRevealLine);

  const layerColor = LAYER_COLOR[step.layer] ?? 'rgba(255,255,255,0.3)';
  const isVuln     = step.isVulnerable;

  const handleClick = () => {
    setSelectedPath(step.filePath);
    setRevealLine(step.line);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
      {/* 노드 */}
      <button
        onClick={handleClick}
        title={`${step.filePath}:${step.line}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          padding: '6px 10px',
          borderRadius: 8,
          background: isVuln ? 'rgba(239,68,68,0.10)' : 'rgba(255,255,255,0.04)',
          border: isVuln
            ? '1px solid rgba(239,68,68,0.40)'
            : `1px solid ${layerColor}33`,
          boxShadow: isVuln ? '0 0 8px #ef4444' : 'none',
          cursor: 'pointer',
          transition: 'all 0.15s',
          minWidth: 80,
        }}
      >
        {/* 레이어 뱃지 */}
        <span
          style={{
            fontSize: 8,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: isVuln ? '#ef4444' : layerColor,
          }}
        >
          {step.layer}
        </span>

        {/* 함수명 */}
        <span
          style={{
            fontSize: 10,
            fontWeight: isVuln ? 700 : 500,
            color: isVuln ? '#f87171' : 'rgba(255,255,255,0.75)',
            fontFamily: 'var(--font-mono)',
            whiteSpace: 'nowrap',
            maxWidth: 120,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {step.label}
        </span>

        {/* 파일:줄 */}
        <span
          style={{
            fontSize: 9,
            color: 'rgba(255,255,255,0.2)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {step.file}:{step.line}
        </span>

        {/* 취약 배지 */}
        {isVuln && (
          <span
            style={{
              fontSize: 8,
              padding: '1px 5px',
              borderRadius: 3,
              background: 'rgba(239,68,68,0.15)',
              color: '#ef4444',
              fontWeight: 700,
            }}
          >
            VULN
          </span>
        )}
      </button>

      {/* 화살표 연결선 */}
      {!isLast && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0 4px',
            color: 'rgba(255,255,255,0.15)',
            fontSize: 12,
            flexShrink: 0,
          }}
        >
          →
        </div>
      )}
    </div>
  );
}

interface CallChainViewProps {
  vuln: Vulnerability;
}

/** CallChainView
 *
 * vuln.callChain 이 있으면 수평 노드 체인으로 렌더링.
 * 없으면 filePath 를 단일 노드로 표시.
 * 노드 클릭 시 에디터 선택 경로 + 라인 이동.
 */
export function CallChainView({ vuln }: CallChainViewProps) {
  const setSelectedPath = useSecureStore((s) => s.setSelectedPath);
  const setRevealLine   = useSecureStore((s) => s.setRevealLine);

  // callChain 이 없는 경우 단일 파일 노드
  if (!vuln.callChain?.length) {
    return (
      <button
        onClick={() => {
          setSelectedPath(vuln.filePath);
          setRevealLine(vuln.lineStart);
        }}
        style={{
          display: 'inline-flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 2,
          padding: '6px 10px',
          borderRadius: 8,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.10)',
          cursor: 'pointer',
          fontFamily: 'var(--font-mono)',
        }}
      >
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>
          파일
        </span>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)' }}>
          {vuln.filePath.split('/').pop()}:{vuln.lineStart}
        </span>
      </button>
    );
  }

  return (
    <div
      style={{
        overflowX: 'auto',
        paddingBottom: 4,
      }}
      aria-label="API 호출 체인"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, minWidth: 'max-content' }}>
        {vuln.callChain.map((step, i) => (
          <ChainNode
            key={`${step.filePath}-${step.line}-${i}`}
            step={step}
            isLast={i === vuln.callChain!.length - 1}
          />
        ))}
      </div>
    </div>
  );
}
