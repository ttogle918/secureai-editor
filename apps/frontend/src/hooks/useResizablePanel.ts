// ================================================================
// hooks/useResizablePanel.ts
// 패널 드래그 리사이즈 훅 — VSCode / Cursor 스타일
// ================================================================
import { useRef, useCallback, useEffect } from 'react';

interface Options {
  direction: 'horizontal' | 'vertical';
  initialSize: number;   // px
  minSize?: number;      // px (default 120)
  maxSize?: number;      // px (default Infinity)
  onResize?: (size: number) => void;
}

export function useResizablePanel({
  direction,
  initialSize,
  minSize = 120,
  maxSize = Infinity,
  onResize,
}: Options) {
  const sizeRef    = useRef(initialSize);
  const dragging   = useRef(false);
  const startPos   = useRef(0);
  const startSize  = useRef(initialSize);
  const containerRef = useRef<HTMLDivElement>(null);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current  = true;
    startPos.current  = direction === 'horizontal' ? e.clientX : e.clientY;
    startSize.current = sizeRef.current;
    document.body.style.cursor  = direction === 'horizontal' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
  }, [direction]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const delta = direction === 'horizontal'
        ? e.clientX - startPos.current
        : e.clientY - startPos.current;
      const next  = Math.min(maxSize, Math.max(minSize, startSize.current + delta));
      sizeRef.current = next;
      containerRef.current.style[direction === 'horizontal' ? 'width' : 'height'] = `${next}px`;
      onResize?.(next);
    };

    const onUp = () => {
      dragging.current = false;
      document.body.style.cursor     = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
  }, [direction, minSize, maxSize, onResize]);

  return { containerRef, onMouseDown, initialSize };
}
