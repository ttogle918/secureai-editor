// hooks/useSse.ts
// SSE 연결 훅 — fetch + ReadableStream 방식 (JWT 헤더 전달 위해 EventSource 미사용)
'use client';

import { useEffect, useRef, useCallback, type MutableRefObject } from 'react';
import { getAccessToken } from '@/lib/api/client';

// ─── 타입 정의 ────────────────────────────────────────────────
export type SseStatus =
  | 'idle'
  | 'connecting'
  | 'open'
  | 'reconnecting'
  | 'closed'
  | 'auth_error';

export interface ProgressEvent {
  sessionId: string;
  type: 'started' | 'node_complete' | 'progress' | 'completed' | 'error' | 'vuln_found';
  node?: string;
  file?: string;
  current?: number;
  total?: number;
  message?: string;
}

export interface SseOptions {
  sessionId: string | null;
  onEvent: (event: ProgressEvent) => void;
  onStatusChange?: (status: SseStatus) => void;
}

// 재연결 지연 시간 (ms): 1s → 2s → 4s → 8s → 16s → 30s 상한
const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 16000, 30000];
const SSE_BASE_URL = '/api/v1/analysis/sessions';

function getRetryDelay(retryCount: number): number {
  const index = Math.min(retryCount, RETRY_DELAYS_MS.length - 1);
  return RETRY_DELAYS_MS[index];
}

function readJwtToken(): string | null {
  return getAccessToken();
}

// ─── 훅 구현 ─────────────────────────────────────────────────
export function useSse({ sessionId, onEvent, onStatusChange }: SseOptions): {
  status: SseStatus;
  disconnect: () => void;
} {
  const statusRef   = useRef<SseStatus>('idle');
  const abortRef    = useRef<AbortController | null>(null);
  const retryRef    = useRef<number>(0);
  const retryTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // onEvent, onStatusChange를 ref로 래핑해 클로저 stale 방지
  const onEventRef        = useRef(onEvent);
  const onStatusChangeRef = useRef(onStatusChange);
  onEventRef.current        = onEvent;
  onStatusChangeRef.current = onStatusChange;

  const setStatus = useCallback((next: SseStatus) => {
    statusRef.current = next;
    onStatusChangeRef.current?.(next);
  }, []);

  const cleanup = useCallback(() => {
    if (retryTimer.current !== null) {
      clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const connect = useCallback(async (sid: string) => {
    const token = readJwtToken();
    if (!token) {
      setStatus('auth_error');
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setStatus(retryRef.current === 0 ? 'connecting' : 'reconnecting');

    try {
      const response = await fetch(`${SSE_BASE_URL}/${sid}/stream`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });

      if (response.status === 401) {
        setStatus('auth_error');
        return; // 인증 오류 시 재연결 안 함
      }

      if (!response.ok || !response.body) {
        throw new Error(`SSE 연결 실패: ${response.status}`);
      }

      setStatus('open');
      retryRef.current = 0; // 연결 성공 시 재시도 카운터 초기화

      const reader  = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer    = '';

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE 메시지는 빈 줄로 구분됨
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? ''; // 마지막 불완전한 청크 보관

        for (const part of parts) {
          parseAndDispatch(part, onEventRef, setStatus, sid);
        }
      }

      // 스트림 정상 종료 — 재연결 불필요
      setStatus('closed');

    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        // 의도적 abort (cleanup) — 상태 변경 없음
        return;
      }

      // 네트워크 오류 등 — 재연결 시도
      const delay = getRetryDelay(retryRef.current);
      retryRef.current += 1;
      setStatus('reconnecting');

      retryTimer.current = setTimeout(() => {
        connect(sid);
      }, delay);
    }
  }, [setStatus]);

  const disconnect = useCallback(() => {
    cleanup();
    retryRef.current = 0;
    setStatus('closed');
  }, [cleanup, setStatus]);

  useEffect(() => {
    if (!sessionId) {
      cleanup();
      retryRef.current = 0;
      setStatus('idle');
      return;
    }

    retryRef.current = 0;
    connect(sessionId);

    return () => {
      cleanup();
    };
  }, [sessionId, connect, cleanup, setStatus]);

  return { status: statusRef.current, disconnect };
}

// ─── SSE 라인 파싱 (내부 유틸) ───────────────────────────────
function parseAndDispatch(
  rawPart: string,
  onEventRef: MutableRefObject<(e: ProgressEvent) => void>,
  setStatus: (s: SseStatus) => void,
  _sessionId: string,
): void {
  const lines = rawPart.split('\n');
  let dataPayload: string | null = null;

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      dataPayload = line.slice('data: '.length).trim();
    }
    // event: 이름 라인은 현재 'progress' 단일이므로 추가 분기 불필요
  }

  if (!dataPayload || dataPayload === '[DONE]') return;

  try {
    const parsed = JSON.parse(dataPayload) as ProgressEvent;
    onEventRef.current(parsed);

    if (parsed.type === 'completed') {
      setStatus('closed');
    }
  } catch {
    // 파싱 실패 시 전체 세션 중단 금지 — skip
  }
}
