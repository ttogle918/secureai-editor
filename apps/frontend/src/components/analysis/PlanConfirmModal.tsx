'use client';
/**
 * STAGE-2: 계획 컨펌 모달 — planning_node interrupt 후 사용자에게 stage/파일 선택을 제공.
 *
 * awaiting_confirmation SSE 이벤트를 수신하면 열림.
 * 전체 승인 / stage 선택 / 파일 제외 후 confirm 버튼 → useConfirmPlan 훅 호출.
 */
import React, { useState, useCallback } from 'react';
import { CheckSquare, Square, ChevronDown, ChevronRight, X } from 'lucide-react';
import type { ConfirmStagePlanItem } from '@/hooks/useSse';
import { useConfirmPlan } from '@/hooks/useConfirmPlan';

interface PlanConfirmModalProps {
  sessionId: string;
  stages: ConfirmStagePlanItem[];
  onClose: () => void;
}

export function PlanConfirmModal({ sessionId, stages, onClose }: PlanConfirmModalProps) {
  // 선택된 stage_no 집합 (초기: 전체 선택)
  const [selectedStageNos, setSelectedStageNos] = useState<Set<number>>(
    () => new Set(stages.map((s) => s.stage_no))
  );
  // 제외된 파일 경로 집합
  const [excludedFilePaths, setExcludedFilePaths] = useState<Set<string>>(new Set());
  // 펼친 stage_no 집합
  const [expandedStages, setExpandedStages] = useState<Set<number>>(new Set());

  const { confirmPlan, isConfirming } = useConfirmPlan();

  const toggleStage = useCallback((stageNo: number) => {
    setSelectedStageNos((prev) => {
      const next = new Set(prev);
      if (next.has(stageNo)) {
        next.delete(stageNo);
      } else {
        next.add(stageNo);
      }
      return next;
    });
  }, []);

  const toggleFile = useCallback((filePath: string) => {
    setExcludedFilePaths((prev) => {
      const next = new Set(prev);
      if (next.has(filePath)) {
        next.delete(filePath);
      } else {
        next.add(filePath);
      }
      return next;
    });
  }, []);

  const toggleExpand = useCallback((stageNo: number) => {
    setExpandedStages((prev) => {
      const next = new Set(prev);
      if (next.has(stageNo)) {
        next.delete(stageNo);
      } else {
        next.add(stageNo);
      }
      return next;
    });
  }, []);

  const hasSelection = selectedStageNos.size > 0;

  const handleConfirm = useCallback(async () => {
    const allSelected = selectedStageNos.size === stages.length;
    await confirmPlan({
      sessionId,
      selectedStageNos: allSelected ? null : Array.from(selectedStageNos),
      excludedFilePaths: Array.from(excludedFilePaths),
    });
    onClose();
  }, [sessionId, selectedStageNos, excludedFilePaths, stages.length, confirmPlan, onClose]);

  return (
    <>
      {/* backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(3px)',
        }}
      />

      {/* modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 301,
          width: '100%', maxWidth: 560,
          maxHeight: '80vh',
          display: 'flex', flexDirection: 'column',
          background: 'var(--bg-2, #1a1a1c)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 12,
          boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
          overflow: 'hidden',
        }}
      >
        {/* header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#e8e8ee' }}>
              분석 계획 확인
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
              분석할 stage와 파일을 선택하세요. 선택하지 않은 항목은 분석에서 제외됩니다.
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(255,255,255,0.35)',
              display: 'flex', alignItems: 'center',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* stage list */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '8px 0' }}>
          {stages.map((stage) => {
            const isStageSelected = selectedStageNos.has(stage.stage_no);
            const isExpanded = expandedStages.has(stage.stage_no);
            const stageExcludedCount = stage.files.filter((f) => excludedFilePaths.has(f)).length;

            return (
              <div key={stage.stage_no} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                {/* stage row */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 16px',
                  cursor: 'pointer',
                  opacity: isStageSelected ? 1 : 0.45,
                  transition: 'opacity 0.15s',
                }}>
                  {/* stage checkbox */}
                  <button
                    onClick={() => toggleStage(stage.stage_no)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}
                  >
                    {isStageSelected
                      ? <CheckSquare size={16} color="var(--orange, #f97316)" />
                      : <Square size={16} color="rgba(255,255,255,0.3)" />
                    }
                  </button>

                  {/* stage info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#e8e8ee' }}>
                      Stage {stage.stage_no}: {stage.name}
                    </span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginLeft: 8 }}>
                      {stage.file_count}개 파일
                      {stageExcludedCount > 0 && (
                        <span style={{ color: 'var(--orange, #f97316)', marginLeft: 4 }}>
                          ({stageExcludedCount}개 제외)
                        </span>
                      )}
                    </span>
                  </div>

                  {/* expand toggle */}
                  <button
                    onClick={() => toggleExpand(stage.stage_no)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}
                  >
                    {isExpanded
                      ? <ChevronDown size={14} color="rgba(255,255,255,0.35)" />
                      : <ChevronRight size={14} color="rgba(255,255,255,0.35)" />
                    }
                  </button>
                </div>

                {/* file list (expanded) */}
                {isExpanded && (
                  <div style={{ paddingLeft: 40, paddingBottom: 8 }}>
                    {stage.files.map((filePath) => {
                      const isExcluded = excludedFilePaths.has(filePath);
                      return (
                        <div
                          key={filePath}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '4px 16px 4px 0',
                            opacity: isExcluded ? 0.35 : 1,
                          }}
                        >
                          <button
                            onClick={() => toggleFile(filePath)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}
                            title={isExcluded ? '제외 해제' : '이 파일 제외'}
                          >
                            {isExcluded
                              ? <Square size={13} color="rgba(255,255,255,0.3)" />
                              : <CheckSquare size={13} color="rgba(255,255,255,0.5)" />
                            }
                          </button>
                          <span
                            style={{
                              fontSize: 11, fontFamily: 'var(--font-mono)',
                              color: 'rgba(255,255,255,0.6)',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              textDecoration: isExcluded ? 'line-through' : 'none',
                            }}
                            title={filePath}
                          >
                            {filePath.split('/').pop()}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 20px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
            {selectedStageNos.size}/{stages.length} stage 선택
            {excludedFilePaths.size > 0 && ` · ${excludedFilePaths.size}개 파일 제외`}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onClose}
              style={{
                padding: '6px 14px', borderRadius: 6,
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.15)',
                color: 'rgba(255,255,255,0.5)',
                fontSize: 12, cursor: 'pointer',
              }}
            >
              취소
            </button>
            <button
              onClick={handleConfirm}
              disabled={!hasSelection || isConfirming}
              style={{
                padding: '6px 14px', borderRadius: 6,
                background: hasSelection ? 'var(--orange-2, #ea580c)' : 'var(--orange-dim)',
                border: 'none',
                color: hasSelection ? '#fff' : 'var(--orange)',
                fontSize: 12, fontWeight: 700,
                cursor: hasSelection && !isConfirming ? 'pointer' : 'not-allowed',
                opacity: isConfirming ? 0.6 : 1,
              }}
            >
              {isConfirming ? '확정 중...' : '분석 시작'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
