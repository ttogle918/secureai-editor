'use client';
import { useEffect, useRef } from 'react';
import { useSecureStore } from '@/store/useSecureStore';
import { apiClient } from '@/lib/api/client';
import type { Severity, VulnCategory, Vulnerability } from '@/lib/mockData';

interface SessionItem {
  id: string;
  status: string;
  vulnCount: number;
  completedAt: string | null;
}

interface VulnItem {
  id: string;
  filePath: string;
  lineNumber: number | null;
  vulnType: string;
  severity: string;
  category: string | null;
  cwe: string | null;
  owasp: string | null;
  description: string | null;
  status: string;
}

const VALID_SEV: Severity[] = ['critical', 'high', 'medium', 'low'];
const VALID_CAT: VulnCategory[] = ['SECURITY', 'CODE_QUALITY'];

export function useLoadLatestResults() {
  const projectId       = useSecureStore((s) => s.projectId);
  const isAnalyzing     = useSecureStore((s) => s.isAnalyzing);
  const addVuln         = useSecureStore((s) => s.addVuln);
  const clearVulns      = useSecureStore((s) => s.clearVulns);
  const clearProgressSteps = useSecureStore((s) => s.clearProgressSteps);

  // 이미 로드한 projectId를 추적해 중복 요청 방지
  const loadedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!projectId || isAnalyzing) return;
    if (loadedRef.current === projectId) return;

    loadedRef.current = projectId;

    async function load() {
      try {
        // 1. 최신 완료 세션 조회
        const sessRes = await apiClient.get<{ data: { content: SessionItem[] } }>(
          `/analysis/sessions?projectId=${projectId}&size=5`,
        );
        const latest = (sessRes.data?.content ?? []).find((s) => s.status === 'completed');
        if (!latest || latest.vulnCount === 0) return;

        // 2. 해당 세션의 취약점 전체 조회 (최대 500개)
        const vulnRes = await apiClient.get<{ data: { content: VulnItem[] } }>(
          `/vulnerabilities?sessionId=${latest.id}&size=500`,
        );
        const items = vulnRes.data?.content ?? [];
        if (items.length === 0) return;

        clearVulns();
        clearProgressSteps();
        for (const v of items) {
          const rawSev = (v.severity ?? 'low').toLowerCase() as Severity;
          const severity: Severity = VALID_SEV.includes(rawSev) ? rawSev : 'low';
          const rawCat = (v.category ?? 'SECURITY') as VulnCategory;
          const category: VulnCategory = VALID_CAT.includes(rawCat) ? rawCat : 'SECURITY';
          const vuln: Vulnerability = {
            id:            v.id,
            type:          v.vulnType,
            severity,
            category,
            lineStart:     v.lineNumber ?? 0,
            lineEnd:       v.lineNumber ?? 0,
            filePath:      v.filePath,
            description:   v.description ?? '',
            cweId:         v.cwe ?? '',
            owaspCategory: v.owasp ?? '',
            status:        'open',
          };
          addVuln(vuln);
        }
      } catch {
        // 조회 실패 시 빈 상태 유지 — 사용자가 직접 분석 시작 가능
      }
    }

    load();
  }, [projectId, isAnalyzing, addVuln, clearVulns, clearProgressSteps]);
}
