'use client';
import { useCallback } from 'react';
import { useSecureStore } from '@/store/useSecureStore';
import { useToastStore } from '@/hooks/useToast';
import { apiClient, ApiError } from '@/lib/api/client';

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
      // 프로젝트 없으면 생성
      let pid = projectId;
      if (!pid) {
        const res = await apiClient.post<{ data: ProjectData }>(
          '/projects',
          { name: workspaceName ?? workspaceId, sourceType: 'local' },
        );
        pid = res.data.id;
        setProjectId(pid);
      }

      // 분석 세션 시작
      const res = await apiClient.post<{ data: SessionData }>(
        '/analysis/sessions',
        { projectId: pid, workspaceRoot: workspaceId, sourceType: 'local' },
      );

      setSseSessionId(res.data.id);
      setViewMode('editor');   // 진행률 패널이 있는 에디터 뷰로 유지
      setRightTab('progress'); // 오른쪽 패널을 진행률 탭으로 자동 전환
      addToast('분석을 시작했습니다. 오른쪽 패널에서 진행 상황을 확인하세요.', 'info');
    } catch (err) {
      setIsAnalyzing(false);
      const msg = err instanceof ApiError ? err.message : '분석 시작에 실패했습니다.';
      addToast(msg, 'error');
    }
  }, [
    workspaceId, workspaceName, projectId, isAnalyzing,
    setProjectId, setSseSessionId, setIsAnalyzing, setViewMode, setRightTab, clearVulns, clearProgressSteps, addToast,
  ]);

  return { startAnalysis, isAnalyzing };
}
