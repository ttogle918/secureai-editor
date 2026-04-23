// components/dashboard/SeverityBarChart.tsx
// OWASP 카테고리별 바 차트
// 와이어프레임: secureai-wireframe.html + secureai-webapp.html 대시보드 바 차트

interface BarChartRow {
  label: string;
  count: number;
  maxCount: number;
  color: string;
}

interface SeverityBarChartProps {
  rows: BarChartRow[];
  title?: string;
}

export function SeverityBarChart({ rows, title }: SeverityBarChartProps) {
  return (
    <div>
      {title && (
        <div
          style={{
            fontSize: 11,
            color: '#9494a0',
            marginBottom: 14,
            letterSpacing: '0.03em',
          }}
        >
          {title}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {rows.map((row) => {
          const pct = row.maxCount > 0 ? (row.count / row.maxCount) * 100 : 0;
          return (
            <div
              key={row.label}
              style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10 }}
            >
              {/* Label */}
              <div
                style={{
                  width: 100,
                  color: '#555560',
                  textAlign: 'right',
                  fontFamily: 'var(--font-mono)',
                  flexShrink: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {row.label}
              </div>
              {/* Track */}
              <div
                style={{
                  flex: 1,
                  height: 10,
                  background: '#161619',
                  borderRadius: 2,
                  overflow: 'hidden',
                }}
                role="progressbar"
                aria-valuenow={row.count}
                aria-valuemin={0}
                aria-valuemax={row.maxCount}
                aria-label={`${row.label}: ${row.count}개`}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${pct}%`,
                    background: row.color,
                    borderRadius: 2,
                    transition: 'width 0.5s ease',
                  }}
                />
              </div>
              {/* Count */}
              <div
                style={{ width: 20, color: '#555560', textAlign: 'right', flexShrink: 0 }}
              >
                {row.count}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
