'use client';
import { useRef, useCallback, useEffect, useState, type ReactNode } from 'react';

interface ResizablePanelGroupProps {
  direction: 'horizontal' | 'vertical';
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

interface ResizablePanelProps {
  children: ReactNode;
  defaultSize: number;      // 0~100 퍼센트
  minSize?: number;
  maxSize?: number;
  style?: React.CSSProperties;
  id?: string;
}

interface ResizableHandleProps {
  direction: 'horizontal' | 'vertical';
  onResize: (delta: number) => void;
}

// ── ResizableHandle ─────────────────────────────────────────
export function ResizableHandle({ direction, onResize }: ResizableHandleProps) {
  const dragging = useRef(false);
  const lastPos  = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    lastPos.current  = direction === 'horizontal' ? e.clientX : e.clientY;

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const curr  = direction === 'horizontal' ? ev.clientX : ev.clientY;
      const delta = curr - lastPos.current;
      lastPos.current = curr;
      onResize(delta);
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp, { once: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, [direction, onResize]);

  const isH = direction === 'horizontal';
  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        flexShrink: 0,
        width:  isH ? 4 : '100%',
        height: isH ? '100%' : 4,
        background: 'transparent',
        cursor: isH ? 'col-resize' : 'row-resize',
        position: 'relative',
        zIndex: 10,
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(234,88,12,0.4)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    />
  );
}

// ── ResizablePanelGroup ──────────────────────────────────────
// 실제로 크기를 관리하는 컨테이너
export function ResizablePanelGroup({ direction, children, style }: ResizablePanelGroupProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: direction === 'horizontal' ? 'row' : 'column',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ── useResizable hook ───────────────────────────────────────
// 두 패널 사이 사이즈를 퍼센트로 관리
export function useResizable(
  initial: number,
  min = 10,
  max = 90,
  direction: 'horizontal' | 'vertical' = 'horizontal',
  containerRef: React.RefObject<HTMLElement | null>
) {
  const [size, setSize] = useState(initial); // 왼쪽/위쪽 패널 퍼센트

  const handleResize = useCallback((delta: number) => {
    const container = containerRef.current;
    if (!container) return;
    const total = direction === 'horizontal' ? container.offsetWidth : container.offsetHeight;
    const pct   = (delta / total) * 100;
    setSize(prev => Math.min(max, Math.max(min, prev + pct)));
  }, [direction, min, max, containerRef]);

  return { size, handleResize };
}
