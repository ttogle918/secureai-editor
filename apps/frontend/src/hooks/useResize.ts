'use client';
import { useRef, useCallback, useEffect } from 'react';

/**
 * 두 패널 사이 드래그 리사이즈 훅
 * direction: 'horizontal' (좌우) | 'vertical' (상하)
 */
export function useResize(
  direction: 'horizontal' | 'vertical',
  initialSize: number,
  min: number,
  max: number,
  onResize: (size: number) => void
) {
  const isDragging = useRef(false);
  const startPos   = useRef(0);
  const startSize  = useRef(initialSize);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      startPos.current   = direction === 'horizontal' ? e.clientX : e.clientY;
      startSize.current  = initialSize;

      const onMove = (ev: MouseEvent) => {
        if (!isDragging.current) return;
        const delta =
          (direction === 'horizontal' ? ev.clientX : ev.clientY) - startPos.current;
        const next = Math.min(max, Math.max(min, startSize.current + delta));
        onResize(next);
      };
      const onUp = () => {
        isDragging.current = false;
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [direction, initialSize, min, max, onResize]
  );

  return { onMouseDown };
}
