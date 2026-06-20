'use client';
import { useEffect, useRef } from 'react';
import { useSecureStore } from '@/store/useSecureStore';
import { useAuthStore } from '@/store/useAuthStore';
import { apiClient } from '@/lib/api/client';
import type { Severity, VulnCategory, Vulnerability, PatchSuggestion } from '@/lib/mockData';
import { normalizeVulnStatus } from '@/lib/mockData';

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

interface PatchItem {
  id: string;
  vulnId: string | null;
  filePath: string;
  vulnType: string;
  originalSnippet: string | null;
  patchedSnippet: string | null;
  explanation: string | null;
}

interface DastResultItem {
  id: string;
  vulnId: string | null;
  vulnType: string;
  status: string;
  success: boolean;
  evidence: string | null;
  payload: string | null;
  responseSnippet: string | null;
  durationMs: number | null;
  retryCount: number;
  executedAt: string | null;
}

const VALID_SEV: Severity[] = ['critical', 'high', 'medium', 'low'];
const VALID_CAT: VulnCategory[] = ['SECURITY', 'CODE_QUALITY'];

export function useLoadLatestResults() {
  const projectId       = useSecureStore((s) => s.projectId);
  const isAnalyzing     = useSecureStore((s) => s.isAnalyzing);
  const lockedSessionId = useSecureStore((s) => s.lockedSessionId);
  const addVuln              = useSecureStore((s) => s.addVuln);
  const clearVulns           = useSecureStore((s) => s.clearVulns);
  const clearProgressSteps   = useSecureStore((s) => s.clearProgressSteps);
  const setPatches           = useSecureStore((s) => s.setPatches);
  const setDastExploitResult = useSecureStore((s) => s.setDastExploitResult);
  const setIsAnalyzing       = useSecureStore((s) => s.setIsAnalyzing);
  const setSseSessionId      = useSecureStore((s) => s.setSseSessionId);
  // auth initAuth() 완료 여부 — true가 되기 전에 API 호출하면 401 발생
  const isAuthInitialized    = useAuthStore((s) => s.isInitialized);

  // 이미 로드한 projectId를 추적해 중복 요청 방지
  const loadedRef = useRef<string | null>(null);

  useEffect(() => {
    // isAnalyzing 중에는 skip (SSE로 실시간 업데이트 중) — 단, 최초 로드 전에는 예외
    if (!projectId) return;
    // initAuth()가 완료되기 전엔 accessToken이 없어 401 발생 → 대기
    if (!isAuthInitialized) return;
    if (isAnalyzing && loadedRef.current === projectId) return;
    if (lockedSessionId) {
      loadedRef.current = projectId;
      return;
    }
    if (loadedRef.current === projectId) return;

    loadedRef.current = projectId;

    async function load() {
      try {
        // 1. 최신 세션 조회 (completed 우선, 없으면 running도 허용)
        const sessRes = await apiClient.get<{ data: { content: SessionItem[] } }>(
          `/analysis/sessions?projectId=${projectId}&size=5`,
        );
        const sessions = sessRes.data?.content ?? [];
        const completedSession = sessions.find((s) => s.status === 'completed');
        const runningSession   = sessions.find((s) => s.status === 'running');
        // completed 우선, 없으면 running 세션 사용
        const latest = completedSession ?? runningSession;
        if (!latest) return;

        // running 세션이면 isAnalyzing=true로 설정 (새로고침 후 복원)
        if (runningSession && !completedSession) {
          setIsAnalyzing(true);
          setSseSessionId(runningSession.id);
        }

        // 2. 해당 세션의 취약점 전체 조회 (최대 500개)
        // vuln_count 컬럼이 실제 DB 취약점 수와 동기화되지 않을 수 있으므로 직접 조회
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
            status:        normalizeVulnStatus(v.status),
          };
          addVuln(vuln);
        }

        // 3. 해당 세션의 패치 제안 조회
        try {
          const patchRes = await apiClient.get<{ data: PatchItem[] }>(
            `/sessions/${latest.id}/patches`,
          );
          const patchItems = patchRes.data ?? [];
          const patches: PatchSuggestion[] = patchItems.map((p) => ({
            vulnId:       p.vulnId ?? undefined,
            filePath:     p.filePath,
            vulnType:     p.vulnType,
            originalCode: p.originalSnippet ?? '',
            patchedCode:  p.patchedSnippet ?? '',
            explanation:  p.explanation ?? '',
          }));
          setPatches(patches);
        } catch {
          // 패치 조회 실패는 취약점 표시에 영향 없음
        }
        // 4. DAST 결과 복원 — vulnId 기반 일괄 조회
        // DAST 세션 ID는 프론트에서 별도 생성한 UUID로, SAST 세션 ID(latest.id)와 다름.
        // vulnId 목록으로 조회해야 새로고침 후에도 결과를 복원할 수 있다.
        try {
          const vulnIds = items.map((v) => v.id);
          if (vulnIds.length > 0) {
            const dastRes = await apiClient.post<{ data: DastResultItem[] }>(
              '/dast/results/by-vuln-ids',
              vulnIds,
            );
            for (const r of (dastRes.data ?? [])) {
              if (!r.vulnId) continue;
              setDastExploitResult(r.vulnId, {
                success: r.success,
                evidence: r.evidence ?? '',
                payload:  r.payload  ?? '',
                responseSnippet: r.responseSnippet ?? '',
                error: null,
                logMessages: [],
              });
            }
          }
        } catch {
          // DAST 결과 없어도 취약점 표시에 영향 없음
        }
      } catch {
        // 조회 실패 시 빈 상태 유지 — 사용자가 직접 분석 시작 가능
      }
    }

    load();
  }, [projectId, isAnalyzing, isAuthInitialized, lockedSessionId, addVuln, clearVulns, clearProgressSteps, setPatches, setDastExploitResult, setIsAnalyzing, setSseSessionId]);
}
