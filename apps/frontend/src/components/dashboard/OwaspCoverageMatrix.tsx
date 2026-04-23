// components/dashboard/OwaspCoverageMatrix.tsx
// OWASP Top 10 A01~A10 커버리지 표
// 와이어프레임: secureai-wireframe.html + secureai-webapp.html 참조
import { OWASP_TOP10 } from '@/lib/constants/owasp';
import type { OwaspCell } from '@/types';

interface OwaspCoverageMatrixProps {
  cells?: OwaspCell[];
  title?: string;
}

function cellStyle(status: OwaspCell['status']): React.CSSProperties {
  switch (status) {
    case 'hit':
      return {
        border: '1px solid rgba(240,65,65,0.30)',
        background: 'rgba(240,65,65,0.06)',
      };
    case 'partial':
      return {
        border: '1px solid rgba(245,158,11,0.30)',
        background: 'rgba(245,158,11,0.06)',
      };
    default:
      return {
        border: '1px solid #1f1f24',
        background: '#161619',
      };
  }
}

function idColor(status: OwaspCell['status']) {
  switch (status) {
    case 'hit':     return '#f04141';
    case 'partial': return '#f59e0b';
    default:        return '#555560';
  }
}

export function OwaspCoverageMatrix({
  cells = OWASP_TOP10,
  title,
}: OwaspCoverageMatrixProps) {
  return (
    <div>
      {title && (
        <div style={{ fontSize: 11, color: '#9494a0', marginBottom: 14 }}>
          {title}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 6,
        }}
        role="grid"
        aria-label="OWASP Top 10 커버리지"
      >
        {cells.map((cell) => (
          <div
            key={cell.id}
            role="gridcell"
            title={`${cell.id}: ${cell.name}`}
            style={{
              borderRadius: 4,
              padding: 8,
              textAlign: 'center',
              ...cellStyle(cell.status),
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: idColor(cell.status),
                marginBottom: 2,
              }}
            >
              {cell.id}
            </div>
            <div style={{ fontSize: 9, color: '#9494a0', lineHeight: 1.3 }}>
              {cell.name}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
        <span style={{ fontSize: 9, color: '#f04141' }}>■ 탐지됨</span>
        <span style={{ fontSize: 9, color: '#f59e0b' }}>■ 부분 탐지</span>
        <span style={{ fontSize: 9, color: '#555560' }}>■ 미커버</span>
      </div>
    </div>
  );
}
