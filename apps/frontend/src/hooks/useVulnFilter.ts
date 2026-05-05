// src/hooks/useVulnFilter.ts
// 스토어의 severityFilter / apiGroupFilter 를 읽어 AND 조건 필터링 수행
import { useMemo } from 'react';
import { useSecureStore } from '@/store/useSecureStore';
import type { Vulnerability } from '@/lib/mockData';

/**
 * useVulnFilter
 *
 * useSecureStore 의 severityFilter + apiGroupFilter 를 읽어
 * AND 조건으로 필터링된 취약점 배열을 반환한다.
 *
 * apiGroupFilter 규칙:
 *   - null          → 전체 포함
 *   - '__none__'    → apiGroup 이 null/undefined 인 취약점만
 *   - 그 외 문자열  → v.apiGroup === filter 인 취약점만
 */
export function useVulnFilter(): Vulnerability[] {
  const vulns          = useSecureStore((s) => s.vulns);
  const severityFilter = useSecureStore((s) => s.severityFilter);
  const apiGroupFilter = useSecureStore((s) => s.apiGroupFilter);

  return useMemo(() => {
    return vulns.filter((v) => {
      // severity AND 조건
      const sevOk =
        severityFilter === 'all' || v.severity === severityFilter;

      // apiGroup AND 조건
      let apiOk: boolean;
      if (apiGroupFilter === null) {
        apiOk = true;
      } else if (apiGroupFilter === '__none__') {
        // API 그룹이 없는 취약점만
        apiOk = v.apiGroup == null;
      } else {
        apiOk = v.apiGroup === apiGroupFilter;
      }

      return sevOk && apiOk;
    });
  }, [vulns, severityFilter, apiGroupFilter]);
}
