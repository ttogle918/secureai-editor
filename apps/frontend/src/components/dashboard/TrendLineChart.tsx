// components/dashboard/TrendLineChart.tsx
// 7일 보안 점수 트렌드 바 차트 (sparkline 스타일)
// 와이어프레임: secureai-wireframe.html + secureai-webapp.html 참조

import type { TrendPoint } from '@/types';

interface TrendLineChartProps {
  data: TrendPoint[];
  title?: string;
  height?: number;
}

export function TrendLineChart({ data, title, height = 70 }: TrendLineChartProps) {
  if (!data || data.length === 0) return null;

  const maxScore = Math.max(...data.map((d) => d.score), 1);

  // Score → color
  const scoreColor = (s: number) =>
    s >= 80 ? '#22c55e' :
    s >= 60 ? '#f97316' :
    s >= 40 ? '#f59e0b' :
    '#f04141';

  return (
    <div>
      {title && (
        <div style={{ fontSize: 11, color: '#9494a0', marginBottom: 14 }}>
          {title}
        </div>
      )}
      <div
        style={{
          height,
          display: 'flex',
          alignItems: 'flex-end',
          gap: 5,
        }}
        role="img"
        aria-label={`보안 점수 트렌드 (${data.length}일)`}
      >
        {data.map((point, i) => {
          const barH = Math.max((point.score / maxScore) * (height - 20), 4);
          const color = scoreColor(point.score);
          const isLast = i === data.length - 1;
          return (
            <div
              key={point.date}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
              }}
              title={`${point.date}: ${point.score}점`}
            >
              <div
                style={{
                  width: '100%',
                  height: barH,
                  background: isLast ? color : `${color}66`,
                  borderRadius: 2,
                  transition: 'height 0.5s ease',
                }}
              />
              <div
                style={{
                  fontSize: 9,
                  color: '#555560',
                  fontFamily: 'var(--font-mono)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '100%',
                }}
              >
                {isLast ? '오늘' : point.date.slice(-4)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
