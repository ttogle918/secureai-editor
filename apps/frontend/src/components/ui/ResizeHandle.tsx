// ── 드래그 가능한 리사이즈 핸들 ─────────────────────────────
'use client';
import { useResize } from '@/hooks/useResize';

interface Props {
  onResize: (delta: number) => void;
  direction?: 'horizontal' | 'vertical';
}

export default function ResizeHandle({ onResize, direction = 'horizontal' }: Props) {
  const { onMouseDown } = useResize(onResize, direction);
  const isH = direction === 'horizontal';

  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        flexShrink: 0,
        width:  isH ? 4 : '100%',
        height: isH ? '100%' : 4,
        cursor: isH ? 'col-resize' : 'row-resize',
        background: 'transparent',
        position: 'relative',
        zIndex: 10,
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(249,115,22,0.4)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    />
  );
}
