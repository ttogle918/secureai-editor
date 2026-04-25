// components/dashboard/SecurityScoreRing.tsx
// 보안 점수 원형 게이지 (SVG 기반)
// 와이어프레임: secureai-mobile.html score ring 참조

interface SecurityScoreRingProps {
  score: number;        // 0 ~ 100
  size?: number;        // px (default 100)
  strokeWidth?: number; // px (default 8)
  trend?: string;       // e.g. "+8점 ↑"
}

export function SecurityScoreRing({
  score,
  size = 100,
  strokeWidth = 8,
  trend,
}: SecurityScoreRingProps) {
  const r         = (size - strokeWidth) / 2;
  const cx        = size / 2;
  const cy        = size / 2;
  const circumf   = 2 * Math.PI * r;
  const dashOffset = circumf * (1 - score / 100);

  // Color based on score
  const color =
    score >= 80 ? '#22c55e' :
    score >= 60 ? '#f97316' :
    score >= 40 ? '#f59e0b' :
    '#f04141';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
      }}
      aria-label={`보안 점수: ${score}점`}
    >
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg
          width={size}
          height={size}
          style={{ transform: 'rotate(-90deg)' }}
          aria-hidden="true"
        >
          {/* Track */}
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke="#161619"
            strokeWidth={strokeWidth}
          />
          {/* Fill */}
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumf}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 1s ease, stroke 0.5s ease' }}
          />
        </svg>
        {/* Center text */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ fontSize: size * 0.26, fontWeight: 700, color, lineHeight: 1 }}>
            {score}
          </span>
          <span style={{ fontSize: size * 0.09, color: '#555560', marginTop: 2 }}>
            점수
          </span>
        </div>
      </div>
      {trend && (
        <span style={{ fontSize: 11, color: '#22c55e' }}>{trend}</span>
      )}
    </div>
  );
}
