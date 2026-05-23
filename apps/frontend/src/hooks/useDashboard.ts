// hooks/useDashboard.ts
// GET /api/v1/projects/{projectId}/dashboard → DashboardData 변환 훅
'use client';
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api/client';
import { OWASP_TOP10 } from '@/lib/constants/owasp';
import type { TrendPoint, FileHeatmapCell, OwaspCell } from '@/types';

// ── 백엔드 응답 타입 ────────────────────────────────────────────
interface ApiSeverityCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
}

interface ApiTrendPoint  { date: string; count: number }
interface ApiHeatPoint   { filePath: string; count: number }

interface ApiDashboardData {
  securityScore:  number;
  severityCounts: ApiSeverityCounts;
  trend:          ApiTrendPoint[];
  fileHeatmap:    ApiHeatPoint[];
  owaspCoverage:  Record<string, boolean>;
}

// ── 프론트엔드 정규화 타입 ──────────────────────────────────────
export interface DashboardData {
  securityScore: number;
  critical:      number;
  high:          number;
  medium:        number;
  low:           number;
  totalVulns:    number;
  trend:         TrendPoint[];       // date + score (count 정규화값)
  fileHeatmap:   FileHeatmapCell[];
  owaspCells:    OwaspCell[];
}

// ── 매핑 유틸 ───────────────────────────────────────────────────

// 일별 count → 상대 높이(0~100)로 정규화 (막대 시각화용)
function mapTrend(trend: ApiTrendPoint[]): TrendPoint[] {
  if (trend.length === 0) return [];
  const max = Math.max(...trend.map((p) => p.count), 1);
  return trend.map((p) => ({
    date:  p.date,
    score: Math.round((p.count / max) * 100),
  }));
}

// 파일별 총 count → FileHeatmapCell (severity 버킷 근사)
function mapHeatmap(heatmap: ApiHeatPoint[]): FileHeatmapCell[] {
  return heatmap.slice(0, 10).map((p) => {
    const n = p.count;
    if (n >= 5) return { file: p.filePath, critical: n, high: 0, medium: 0, low: 0 };
    if (n >= 3) return { file: p.filePath, critical: 0, high: n, medium: 0, low: 0 };
    if (n >= 1) return { file: p.filePath, critical: 0, high: 0, medium: n, low: 0 };
    return         { file: p.filePath, critical: 0, high: 0, medium: 0, low: 0 };
  });
}

// owaspCoverage Map<String, Boolean> → OwaspCell[]
function mapOwasp(coverage: Record<string, boolean>): OwaspCell[] {
  return OWASP_TOP10.map((cell) => ({
    ...cell,
    status: coverage[cell.id] === true ? ('hit' as const) : ('none' as const),
  }));
}

// ── 훅 ─────────────────────────────────────────────────────────
export function useDashboard(projectId: string | null) {
  const [data,      setData]      = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!projectId) { setData(null); return; }
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{ data: ApiDashboardData }>(
        `/projects/${projectId}/dashboard`,
      );
      const d = res.data;
      const total =
        d.severityCounts.critical + d.severityCounts.high +
        d.severityCounts.medium  + d.severityCounts.low;
      setData({
        securityScore: d.securityScore,
        critical:      d.severityCounts.critical,
        high:          d.severityCounts.high,
        medium:        d.severityCounts.medium,
        low:           d.severityCounts.low,
        totalVulns:    total,
        trend:         mapTrend(d.trend),
        fileHeatmap:   mapHeatmap(d.fileHeatmap),
        owaspCells:    mapOwasp(d.owaspCoverage),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : '대시보드 데이터를 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  return { data, isLoading, error, refetch: load };
}
