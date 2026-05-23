'use client';
import { useEffect } from 'react';
import { useSecureStore } from '@/store/useSecureStore';
import type { DastLog } from '@/lib/mockData';

const AI_ENGINE = process.env.NEXT_PUBLIC_AI_ENGINE_URL ?? 'http://localhost:8000';

export function useDastStream() {
  const dastSessionId      = useSecureStore((s) => s.dastSessionId);
  const addDastLog         = useSecureStore((s) => s.addDastLog);
  const setDastExploitResult = useSecureStore((s) => s.setDastExploitResult);
  const setDastSessionId   = useSecureStore((s) => s.setDastSessionId);

  useEffect(() => {
    if (!dastSessionId) return;
    if (typeof window === 'undefined') return;
    // UUID 형식 검증 — 경로 조작 방어
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(dastSessionId)) return;

    const es = new EventSource(
      `${AI_ENGINE}/agent/dast/logs/${encodeURIComponent(dastSessionId)}`,
    );

    es.onmessage = (event: MessageEvent) => {
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(event.data) as Record<string, unknown>;
      } catch {
        // JSON 파싱 실패 시 원문을 info 로그로 추가
        const log: DastLog = {
          timestamp: new Date().toLocaleTimeString('ko-KR'),
          level: 'info',
          message: event.data as string,
        };
        addDastLog(log);
        return;
      }

      const type = data['type'];

      if (type === 'keepalive') {
        // keepalive는 연결 유지용 — UI에 노출하지 않음
        return;
      }

      if (type === 'dast_result') {
        const vulnId          = data['vulnId'] as string;
        const success         = data['success'] as boolean;
        const evidence        = (data['evidence'] as string) ?? '';
        const payload         = (data['payload'] as string) ?? '';
        const responseSnippet = (data['responseSnippet'] as string) ?? '';
        const error           = (data['error'] as string | null) ?? null;
        const logMessages     = (data['logMessages'] as string[]) ?? [];

        // logMessages 각 줄을 DastLog로 추가
        const level: DastLog['level'] = success ? 'success' : 'warn';
        logMessages.forEach((msg) => {
          addDastLog({
            timestamp: new Date().toLocaleTimeString('ko-KR'),
            level,
            message: msg,
          });
        });

        setDastExploitResult(vulnId, {
          success,
          evidence,
          payload,
          responseSnippet,
          error,
          logMessages,
        });

        setDastSessionId(null);
        es.close();
        return;
      }

      if (type === 'dast_error') {
        const errorMsg = (data['error'] as string) ?? '[DAST] 알 수 없는 오류';
        addDastLog({
          timestamp: new Date().toLocaleTimeString('ko-KR'),
          level: 'error',
          message: errorMsg,
        });
        setDastSessionId(null);
        es.close();
        return;
      }

      // 알 수 없는 타입은 info 로그로 표시
      addDastLog({
        timestamp: new Date().toLocaleTimeString('ko-KR'),
        level: 'info',
        message: `[SSE] ${JSON.stringify(data)}`,
      });
    };

    es.onerror = () => {
      addDastLog({
        timestamp: new Date().toLocaleTimeString('ko-KR'),
        level: 'error',
        message: '[SSE] Connection error — DAST 스트림 연결 실패',
      });
      setDastSessionId(null);
      es.close();
    };

    return () => {
      es.close();
    };
  }, [dastSessionId, addDastLog, setDastExploitResult, setDastSessionId]);
}
