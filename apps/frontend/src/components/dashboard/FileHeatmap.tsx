// components/dashboard/FileHeatmap.tsx
// 파일별 취약점 히트맵 — worst severity 색상 기반
import type { FileHeatmapCell } from '@/types';

interface FileHeatmapProps {
  cells: FileHeatmapCell[];
  title?: string;
}

function getCellStyle(cell: FileHeatmapCell): React.CSSProperties {
  if (cell.critical > 0) {
    return {
      background: 'rgba(240,65,65,0.07)',
      border: '1px solid rgba(240,65,65,0.25)',
    };
  }
  if (cell.high > 0) {
    return {
      background: 'rgba(245,158,11,0.07)',
      border: '1px solid rgba(245,158,11,0.20)',
    };
  }
  if (cell.medium > 0) {
    return {
      background: 'rgba(234,179,8,0.07)',
      border: '1px solid rgba(234,179,8,0.20)',
    };
  }
  return {
    background: '#161619',
    border: '1px solid #1f1f24',
  };
}

function getCellCountStyle(cell: FileHeatmapCell) {
  if (cell.critical > 0) return { color: '#f04141' };
  if (cell.high     > 0) return { color: '#f59e0b' };
  if (cell.medium   > 0) return { color: '#eab308' };
  return { color: '#22c55e' };
}

function getSummaryText(cell: FileHeatmapCell) {
  if (cell.critical > 0) return `${cell.critical} Critical`;
  if (cell.high     > 0) return `${cell.high} High`;
  if (cell.medium   > 0) return `${cell.medium} Medium`;
  return 'Clean';
}

export function FileHeatmap({ cells, title }: FileHeatmapProps) {
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
        role="list"
        aria-label="파일별 취약점 히트맵"
      >
        {cells.map((cell) => (
          <div
            key={cell.file}
            role="listitem"
            title={`${cell.file}: ${getSummaryText(cell)}`}
            style={{
              borderRadius: 4,
              padding: 8,
              cursor: 'pointer',
              transition: 'border-color 0.15s',
              ...getCellStyle(cell),
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                color: '#555560',
                marginBottom: 4,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {cell.file.split('/').pop()}
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                ...getCellCountStyle(cell),
              }}
            >
              {getSummaryText(cell)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
