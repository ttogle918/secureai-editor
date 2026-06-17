'use client';
import { useCallback, useState } from 'react';
import { useSecureStore } from '@/store/useSecureStore';
import { useToastStore } from '@/hooks/useToast';
import { apiClient, ApiError } from '@/lib/api/client';
import type { ScanMode } from '@/components/analysis/ScanModeSelector';

interface ProjectData { id: string; }
interface SessionData  { id: string; }

export function useStartAnalysis() {
  const workspaceId   = useSecureStore((s) => s.workspaceId);
  const workspaceName = useSecureStore((s) => s.workspaceName);
  const projectId     = useSecureStore((s) => s.projectId);
  const isAnalyzing   = useSecureStore((s) => s.isAnalyzing);
  const setProjectId       = useSecureStore((s) => s.setProjectId);
  const setSseSessionId    = useSecureStore((s) => s.setSseSessionId);
  const setIsAnalyzing     = useSecureStore((s) => s.setIsAnalyzing);
  const setViewMode        = useSecureStore((s) => s.setViewMode);
  const setRightTab        = useSecureStore((s) => s.setRightTab);
  const clearVulns         = useSecureStore((s) => s.clearVulns);
  const clearProgressSteps = useSecureStore((s) => s.clearProgressSteps);
  const addToast        = useToastStore((s) => s.addToast);

  const [scanMode, setScanMode] = useState<ScanMode>(() => {
    if (typeof window === 'undefined') return 'PIPELINE';
    return (localStorage.getItem('scanModeDefault') as ScanMode) ?? 'PIPELINE';
  });

  /** STAGE-2: planningMode — 'DETERMINISTIC' | 'LLM'. */
  type PlanningMode = 'DETERMINISTIC' | 'LLM';

  const createSession = useCallback(async (
    pid: string,
    force = false,
    mode: ScanMode = 'PIPELINE',
    fileFilter?: string[],
    planningMode?: PlanningMode,
    confirmGate?: boolean,
  ) => {
    const res = await apiClient.post<{ data: SessionData }>(
      '/analysis/sessions',
      {
        projectId: pid, workspaceRoot: workspaceId, sourceType: 'local', force, scanMode: mode,
        ...(fileFilter && fileFilter.length ? { fileFilter } : {}),
        ...(planningMode ? { planningMode } : {}),
        ...(confirmGate !== undefined ? { confirmGate } : {}),
      },
    );
    setSseSessionId(res.data.id);
    setViewMode('editor');
    setRightTab('progress');
    addToast('분석을 시작했습니다. 오른쪽 패널에서 진행 상황을 확인하세요.', 'info');
  }, [workspaceId, setSseSessionId, setViewMode, setRightTab, addToast]);

  const startAnalysis = useCallback(async () => {
    if (isAnalyzing) return;

    if (!workspaceId) {
      addToast('먼저 프로젝트 폴더를 열어주세요.', 'error');
      return;
    }

    setIsAnalyzing(true);
    clearVulns();
    clearProgressSteps();

    try {
      // 프로젝트 없으면 생성, 이미 있으면 목록에서 조회해서 재사용
      let pid = projectId;
      if (!pid) {
        try {
          const res = await apiClient.post<{ data: ProjectData }>(
            '/projects',
            { name: workspaceName ?? workspaceId, sourceType: 'local' },
          );
          pid = res.data.id;
          setProjectId(pid);
        } catch (err) {
          if (err instanceof ApiError && err.code === 'PROJECT_DUPLICATE_NAME') {
            const listRes = await apiClient.get<{ data: { content: ProjectData[] } }>('/projects');
            const name = workspaceName ?? workspaceId;
            const items: ProjectData[] = listRes.data?.content ?? (listRes.data as any) ?? [];
            const existing = items.find((p: any) => p.name === name);
            if (!existing) throw err;
            pid = existing.id;
            setProjectId(pid);
          } else {
            throw err;
          }
        }
      }

      // 분석 세션 시작
      try {
        await createSession(pid, false, scanMode);
      } catch (err) {
        if (err instanceof ApiError && err.code === 'SESSION_ALREADY_RUNNING') {
          setIsAnalyzing(false);
          addToast(
            '진행 중인 분석이 있습니다. 새로 시작하시겠습니까?',
            'warning',
            {
              label: '새로 시작',
              onClick: async () => {
                setIsAnalyzing(true);
                clearVulns();
                clearProgressSteps();
                try {
                  await createSession(pid!, true, scanMode);
                } catch {
                  setIsAnalyzing(false);
                  addToast('분석 시작에 실패했습니다.', 'error');
                }
              },
            },
          );
        } else {
          throw err;
        }
      }
    } catch (err) {
      setIsAnalyzing(false);
      const msg = err instanceof ApiError ? err.message : '분석 시작에 실패했습니다.';
      addToast(msg, 'error');
    }
  }, [
    workspaceId, workspaceName, projectId, isAnalyzing, scanMode,
    setProjectId, setSseSessionId, setIsAnalyzing, setViewMode, setRightTab,
    clearVulns, clearProgressSteps, addToast, createSession,
  ]);

  /** 선택 분석 (TASK-1106) — 지정한 파일만 재분석. 기존 projectId 재사용, 항상 새 세션(force). */
  const startSelectiveAnalysis = useCallback(async (fileFilter: string[]) => {
    if (isAnalyzing) return;
    if (!projectId) { addToast('먼저 전체 분석을 한 번 실행해주세요.', 'error'); return; }
    if (!fileFilter.length) { addToast('분석할 API 그룹을 선택해주세요.', 'warning'); return; }
    setIsAnalyzing(true);
    clearVulns();
    clearProgressSteps();
    try {
      await createSession(projectId, true, scanMode, fileFilter);
    } catch (err) {
      setIsAnalyzing(false);
      const msg = err instanceof ApiError ? err.message : '선택 분석 시작에 실패했습니다.';
      addToast(msg, 'error');
    }
  }, [projectId, isAnalyzing, scanMode, setIsAnalyzing, clearVulns, clearProgressSteps, addToast, createSession]);

  return { startAnalysis, startSelectiveAnalysis, isAnalyzing, scanMode, setScanMode };
}
