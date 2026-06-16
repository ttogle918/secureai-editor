/**
 * STAGE-1: stage 완료 이벤트 수신 후 해당 stage 파일 목록으로
 * 취약점을 조회하여 store에 누적하는 훅.
 */
'use client';

import { useCallback } from 'react';
import { fetchVulnerabilitiesByFiles, type VulnItem } from '@/lib/api/vulnerabilities';
import { useSecureStore, type StageVulnSummary } from '@/store/useSecureStore';
import { useToastStore } from '@/hooks/useToast';

function toSummary(v: VulnItem): StageVulnSummary {
  return {
    id: v.id,
    filePath: v.filePath,
    lineNumber: v.lineNumber,
    vulnType: v.vulnType,
    severity: v.severity,
  };
}

export function useVulnerabilitiesByFiles() {
  const setStageVulns = useSecureStore((s) => s.setStageVulns);
  const addToast = useToastStore((s) => s.addToast);

  /**
   * stage_completed 이벤트 수신 시 호출.
   * files가 없으면 스킵(구버전 이벤트 하위호환).
   * 조회 실패 시 toast + 빈 목록 처리 — 세션 중단 금지.
   */
  const fetchAndStore = useCallback(
    async (sessionId: string, stageNo: number, files: string[] | undefined) => {
      if (!files || files.length === 0) {
        // 구버전 이벤트: files 없음 → markStageCompleted만(호출부에서 처리)
        return;
      }

      try {
        const vulns = await fetchVulnerabilitiesByFiles(sessionId, files);
        setStageVulns(stageNo, vulns.map(toSummary));
      } catch (err) {
        // 개별 조회 실패 — skip & log, 세션 중단 금지
        console.error('[STAGE-1] stage vuln fetch failed', { stageNo, err });
        setStageVulns(stageNo, []); // 빈 목록으로 loaded=true 표기
        addToast(`Stage ${stageNo} 취약점 조회에 실패했습니다.`, 'error');
      }
    },
    // Zustand 액션은 스토어 수명 동안 안정적 레퍼런스 — deps에 넣어도 재생성 안 됨
    [setStageVulns, addToast],
  );

  return { fetchAndStore };
}
