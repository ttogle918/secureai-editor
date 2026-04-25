'use client';
import { useRef, useCallback, useEffect } from 'react';

/**
 * 두 패널 사이 드래그 리사이즈 훅
 * direction: 'horizontal' (좌우) | 'vertical' (상하)
 */
export function useResize(
  direction: 'horizontal' | 'vertical',
  onResize: (delta: number) => void
) {
  const isDragging = useRef(false);
  const lastPos    = useRef(0);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      lastPos.current    = direction === 'horizontal' ? e.clientX : e.clientY;

      const onMove = (ev: MouseEvent) => {
        if (!isDragging.current) return;
        const currentPos = direction === 'horizontal' ? ev.clientX : ev.clientY;
        const delta = currentPos - lastPos.current;
        
        if (delta !== 0) {
          onResize(delta);
          lastPos.current = currentPos;
        }
      };

      const onUp = () => {
        isDragging.current = false;
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        document.body.style.cursor = 'default';
      };

      document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [direction, onResize]
  );

  return { onMouseDown };
}
