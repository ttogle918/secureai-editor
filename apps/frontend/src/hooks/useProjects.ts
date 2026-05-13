'use client';
import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/client';

export interface ProjectSummary {
  id: string;
  name: string;
  lastAnalyzedAt: string | null;
  vulnCount: number;
}

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
  const [projects, setProjects]   = useState<ProjectSummary[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    async function fetch() {
      try {
        const res = await apiClient.get<{ data: ProjectItem[] }>('/projects');
        const items: ProjectItem[] = res.data ?? [];

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
      } catch {
        setProjects([]);
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, []);

  return { projects, loading };
}
