'use client';
import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/client';
import { useSecureStore, type WorkspaceProject } from '@/store/useSecureStore';

export type ProjectSummary = WorkspaceProject;

interface ProjectItem {
  id: string;
  name: string;
}

interface SessionItem {
  id: string;
  status: string;
  vulnCount: number;
  completedAt: string | null;
}

export function useProjects() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading]   = useState(true);

  const projectId           = useSecureStore((s) => s.projectId);
  const setProjectId        = useSecureStore((s) => s.setProjectId);
  const setWorkspaceProjects = useSecureStore((s) => s.setWorkspaceProjects);

  useEffect(() => {
    async function load() {
      try {
        const res = await apiClient.get<{ data: { content: ProjectItem[] } }>('/projects');
        const items: ProjectItem[] = res.data?.content ?? (res.data as any) ?? [];

        const summaries = await Promise.all(
          items.map(async (p) => {
            try {
              const sessRes = await apiClient.get<{ data: { content: SessionItem[] } }>(
                `/analysis/sessions?projectId=${p.id}&size=1`,
              );
              const latest = (sessRes.data?.content ?? []).find((s) => s.status === 'completed');
              return {
                id:             p.id,
                name:           p.name,
                lastAnalyzedAt: latest?.completedAt ?? null,
                vulnCount:      latest?.vulnCount ?? 0,
              } satisfies ProjectSummary;
            } catch {
              return { id: p.id, name: p.name, lastAnalyzedAt: null, vulnCount: 0 };
            }
          }),
        );

        setProjects(summaries);
        setWorkspaceProjects(summaries); // 전역 캐시 업데이트

        // projectId가 없으면 가장 최근 분석 프로젝트 자동 선택
        if (!projectId && summaries.length > 0) {
          const latest = [...summaries].sort((a, b) =>
            (b.lastAnalyzedAt ?? '').localeCompare(a.lastAnalyzedAt ?? ''),
          )[0];
          setProjectId(latest.id);
        }
      } catch {
        setProjects([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  // projectId/setProjectId를 deps에서 제외 — 마운트 시 1회만 실행
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { projects, loading };
}
