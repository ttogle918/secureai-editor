'use client';
/**
 * 배치 DAST SSE 훅
 * dastBatchSessionId가 설정되면 SSE를 구독하고,
 * 각 타깃 완료(dast_result) 이벤트를 처리한다.
 * 전체 완료는 dast_batch_complete 이벤트로 판단하여 세션을 닫는다.
 * 단건 DAST(useDastStream)와 독립적으로 동작한다.
 */
import { useEffect } from 'react';
import { useSecureStore } from '@/store/useSecureStore';
import type { DastLog } from '@/lib/mockData';

const AI_ENGINE = process.env.NEXT_PUBLIC_AI_ENGINE_URL ?? 'http://localhost:8000';

// UUID 형식 검증 — 경로 조작 방어 (단건 DAST와 동일 패턴)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface DastBatchCompleteData {
  total: number;
  succeeded: number;
  skipped: number;
}

export function useDastBatchStream() {
  const dastBatchSessionId  = useSecureStore((s) => s.dastBatchSessionId);
  const addDastLog          = useSecureStore((s) => s.addDastLog);
  const setDastExploitResult = useSecureStore((s) => s.setDastExploitResult);
  const setDastBatchSessionId = useSecureStore((s) => s.setDastBatchSessionId);
  const setDastBatchSummary   = useSecureStore((s) => s.setDastBatchSummary);

  useEffect(() => {
    if (!dastBatchSessionId) return;
    if (typeof window === 'undefined') return;
    if (!UUID_RE.test(dastBatchSessionId)) return;

    const es = new EventSource(
      `${AI_ENGINE}/agent/dast/logs/${encodeURIComponent(dastBatchSessionId)}?batch=true`,
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

      if (type === 'keepalive') return;

      if (type === 'dast_result') {
        // 배치 모드: vulnId별 결과를 순차로 수신
        const vulnId          = data['vulnId'] as string;
        const success         = data['success'] as boolean;
        const evidence        = (data['evidence'] as string) ?? '';
        const payload         = (data['payload'] as string) ?? '';
        const responseSnippet = (data['responseSnippet'] as string) ?? '';
        const error           = (data['error'] as string | null) ?? null;
        const logMessages     = (data['logMessages'] as string[]) ?? [];

        const level: DastLog['level'] = success ? 'success' : 'warn';
        logMessages.forEach((msg) => {
          addDastLog({
            timestamp: new Date().toLocaleTimeString('ko-KR'),
            level,
            message: `[${vulnId}] ${msg}`,
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
        // 배치 모드: dast_result 수신 후 스트림을 닫지 않음 — dast_batch_complete까지 유지
        return;
      }

      if (type === 'dast_batch_complete') {
        const summary = data as unknown as DastBatchCompleteData;
        setDastBatchSummary({
          total: summary.total,
          succeeded: summary.succeeded,
          skipped: summary.skipped,
        });
        addDastLog({
          timestamp: new Date().toLocaleTimeString('ko-KR'),
          level: 'success',
          message: `[배치 DAST 완료] 전체 ${summary.total}건, 성공 ${summary.succeeded}건, 건너뜀 ${summary.skipped}건`,
        });
        setDastBatchSessionId(null);
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
        setDastBatchSessionId(null);
        es.close();
        return;
      }

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
        message: '[SSE] Connection error — 배치 DAST 스트림 연결 실패',
      });
      setDastBatchSessionId(null);
      es.close();
    };

    return () => {
      es.close();
    };
  }, [dastBatchSessionId, addDastLog, setDastExploitResult, setDastBatchSessionId, setDastBatchSummary]);
}
