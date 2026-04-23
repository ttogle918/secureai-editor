import { useState, useMemo } from 'react';
import type { Vulnerability, Severity } from '@/lib/mockData';

export type FilterSeverity = Severity | 'all';
export type FilterApiGroup = string | 'all' | 'standalone'; // 'standalone' = API 없는 독립 파일

export interface VulnFilter {
  severity: FilterSeverity;
  apiGroup: FilterApiGroup;
}

export function useVulnFilter(vulns: Vulnerability[]) {
  const [filter, setFilter] = useState<VulnFilter>({ severity: 'all', apiGroup: 'all' });

  // API 그룹 목록 자동 추출
  const apiGroups = useMemo(() => {
    const groups = new Set<string>();
    vulns.forEach(v => {
      if (v.apiGroup) groups.add(v.apiGroup);
    });
    return Array.from(groups).sort();
  }, [vulns]);

  // 필터 적용
  const filtered = useMemo(() => {
    return vulns.filter(v => {
      const sevOk = filter.severity === 'all' || v.severity === filter.severity;
      const apiOk =
        filter.apiGroup === 'all' ||
        (filter.apiGroup === 'standalone' && !v.apiGroup) ||
        (v.apiGroup && v.apiGroup === filter.apiGroup) ||
        // /api/users 필터 시 /api/users/login 도 매치
        (v.apiEndpoint && filter.apiGroup !== 'standalone' && v.apiEndpoint.includes(filter.apiGroup));
      return sevOk && apiOk;
    });
  }, [vulns, filter]);

  const setSeverity = (s: FilterSeverity) => setFilter(f => ({ ...f, severity: s }));
  const setApiGroup = (g: FilterApiGroup) => setFilter(f => ({ ...f, apiGroup: g }));
  const reset = () => setFilter({ severity: 'all', apiGroup: 'all' });

  // 심각도별 카운트
  const counts = useMemo(() => ({
    critical: vulns.filter(v => v.severity === 'critical').length,
    high:     vulns.filter(v => v.severity === 'high').length,
    medium:   vulns.filter(v => v.severity === 'medium').length,
    low:      vulns.filter(v => v.severity === 'low').length,
    total:    vulns.length,
  }), [vulns]);

  return { filter, filtered, apiGroups, counts, setSeverity, setApiGroup, reset };
}
