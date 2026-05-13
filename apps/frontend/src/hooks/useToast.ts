// hooks/useToast.ts
// Zustand 독립 Toast 스토어 — SSE 이벤트 등에서 알림 표시용
import { create } from 'zustand';

// ─── 타입 정의 ────────────────────────────────────────────────
export type ToastSeverity = 'critical' | 'high' | 'info' | 'error';

export interface Toast {
  id: string;
  message: string;
  severity: ToastSeverity;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (message: string, severity: ToastSeverity) => void;
  removeToast: (id: string) => void;
}

const AUTO_DISMISS_MS = 4000;

// ─── 스토어 구현 ─────────────────────────────────────────────
export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],

  addToast: (message, severity) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    set((s) => ({ toasts: [...s.toasts, { id, message, severity }] }));

    // 4000ms 후 자동 제거
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, AUTO_DISMISS_MS);
  },

  removeToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));
