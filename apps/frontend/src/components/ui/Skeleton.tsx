// components/ui/Skeleton.tsx
// UI/UX REVISIONS.md §9 — 로딩 스켈레톤

interface SkeletonProps {
  height?: number | string;
  width?: number | string;
  borderRadius?: number;
  className?: string;
}

export function Skeleton({
  height = 20,
  width = '100%',
  borderRadius = 4,
  className,
}: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`skeleton${className ? ` ${className}` : ''}`}
      style={{ height, width, borderRadius }}
    />
  );
}

/** 블록 여러 개를 세로로 쌓은 스켈레톤 그룹 */
export function SkeletonGroup({ count = 3, gap = 8 }: { count?: number; gap?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap }}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} height={18} width={`${90 - i * 10}%`} />
      ))}
    </div>
  );
}
