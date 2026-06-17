'use client';
/**
 * STAGE-2: 계획 컨펌 훅 — useStartAnalysis와 분리된 전용 훅.
 *
 * 책임: 사용자가 PlanConfirmModal에서 선택한 stage/파일 목록을 백엔드 confirm API에 전달.
 * createSession과 완전히 분리하여 단일 책임 원칙(SRP) 준수.
 */
import { useCallback, useState } from 'react';
import { useSecureStore } from '@/store/useSecureStore';
import { useToastStore } from '@/hooks/useToast';
import { apiClient, ApiError } from '@/lib/api/client';

interface ConfirmPlanParams {
  sessionId: string;
  selectedStageNos: number[] | null;
  excludedFilePaths: string[];
}

export function useConfirmPlan() {
  const [isConfirming, setIsConfirming] = useState(false);
  const clearAwaitingConfirmation = useSecureStore((s) => s.clearAwaitingConfirmation);
  const setIsAnalyzing             = useSecureStore((s) => s.setIsAnalyzing);
  const addToast                   = useToastStore((s) => s.addToast);

  /**
   * 컨펌 요청 전송.
   * 성공 시 awaitingConfirmation 상태 초기화 + 분석 재개(isAnalyzing = true).
   */
  const confirmPlan = useCallback(async ({
    sessionId,
    selectedStageNos,
    excludedFilePaths,
  }: ConfirmPlanParams) => {
    if (isConfirming) return;
    setIsConfirming(true);

    try {
      await apiClient.post(
        `/analysis/sessions/${sessionId}/confirm`,
        {
          selectedStageNos,
          excludedFilePaths,
        },
      );

      clearAwaitingConfirmation();
      setIsAnalyzing(true);
      addToast('분석 계획이 확정되었습니다. 분석을 재개합니다.', 'info');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : '컨펌 요청에 실패했습니다.';
      addToast(msg, 'error');
    } finally {
      setIsConfirming(false);
    }
  }, [isConfirming, clearAwaitingConfirmation, setIsAnalyzing, addToast]);

  return { confirmPlan, isConfirming };
}
