import { useRef, useCallback, useEffect } from 'react';

type Direction = 'horizontal' | 'vertical';

interface UseResizeOptions {
  direction: Direction;
  initialSize: number;
  minSize?: number;
  maxSize?: number;
  onResize?: (size: number) => void;
}

/**
 * 드래그로 패널 크기를 조절하는 훅.
 * resizeHandleProps 를 <div> 에 spread 하면 드래그 핸들이 됩니다.
 */
export function usePanelResize({ direction, initialSize, minSize = 120, maxSize = 1200, onResize }: UseResizeOptions) {
  const sizeRef = useRef(initialSize);
  const dragging = useRef(false);
  const startPos = useRef(0);
  const startSize = useRef(initialSize);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    startPos.current = direction === 'horizontal' ? e.clientX : e.clientY;
    startSize.current = sizeRef.current;
    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
  }, [direction]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const delta = direction === 'horizontal'
        ? e.clientX - startPos.current
        : e.clientY - startPos.current;
      const next = Math.min(maxSize, Math.max(minSize, startSize.current + delta));
      sizeRef.current = next;
      containerRef.current.style[direction === 'horizontal' ? 'width' : 'height'] = `${next}px`;
      onResize?.(next);
    };

    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [direction, maxSize, minSize, onResize]);

  const resizeHandleProps = {
    onMouseDown,
    style: {
      flexShrink: 0,
      ...(direction === 'horizontal'
        ? { width: 4, cursor: 'col-resize', background: 'transparent' }
        : { height: 4, cursor: 'row-resize', background: 'transparent' }),
    } as React.CSSProperties,
  };

  return { containerRef, resizeHandleProps, initialSize };
}
