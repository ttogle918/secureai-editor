// components/analysis/CallChainView.tsx
// API 호출 체인 트리 시각화
// 와이어프레임: 취약 노드는 빨간 글로우, 일반 노드는 회색
import type { CallChainNode } from '@/types';

interface CallChainViewProps {
  chain: CallChainNode[];
  depth?: number;
}

function ChainNodeRow({
  node,
  depth = 0,
}: {
  node: CallChainNode;
  depth: number;
}) {
  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          paddingLeft: depth * 16,
        }}
      >
        {depth > 0 && (
          <span style={{ color: '#2a2a30', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
            └─
          </span>
        )}
        <span
          style={{
            display: 'inline-block',
            padding: '2px 8px',
            borderRadius: 3,
            fontSize: 10,
            fontFamily: 'var(--font-mono)',
            cursor: 'pointer',
            transition: 'all 0.1s',
            ...(node.isVulnerable
              ? {
                  color: '#f04141',
                  background: 'rgba(240,65,65,0.10)',
                  border: '1px solid rgba(240,65,65,0.25)',
                  boxShadow: '0 0 10px rgba(240,65,65,0.20)',
                }
              : {
                  color: '#555560',
                  background: 'transparent',
                }),
          }}
        >
          {node.label}
          {node.isVulnerable && (
            <span style={{ marginLeft: 6, fontSize: 9, color: '#f04141' }}>⬟</span>
          )}
        </span>
      </div>
      {node.children?.map((child) => (
        <ChainNodeRow key={child.id} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

export function CallChainView({ chain, depth = 0 }: CallChainViewProps) {
  if (!chain || chain.length === 0) {
    return (
      <p style={{ fontSize: 10, color: '#555560', fontFamily: 'var(--font-mono)' }}>
        호출 체인 정보 없음
      </p>
    );
  }

  return (
    <div
      style={{
        background: '#0d0d0f',
        border: '1px solid #1f1f24',
        borderRadius: 4,
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        lineHeight: '20px',
      }}
      aria-label="API 호출 체인"
    >
      {chain.map((node) => (
        <ChainNodeRow key={node.id} node={node} depth={depth} />
      ))}
    </div>
  );
}
