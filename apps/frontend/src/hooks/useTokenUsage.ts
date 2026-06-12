// hooks/useTokenUsage.ts
// GET /api/v1/users/me/token-usage?from=&to= 조회 훅 (COST-3)
'use client';
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api/client';

// ── 백엔드 응답 타입 ────────────────────────────────────────────────────────

export interface DailyUsageEntry {
  date: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  costUsd: string; // BigDecimal → string (JSON)
}

export interface TokenUsageSummary {
  daily: DailyUsageEntry[];
  totalCostUsd: string;
  cacheHitRate: number;
}

// ── 훅 ─────────────────────────────────────────────────────────────────────

export function useTokenUsage(from: string, to: string) {
  const [data,      setData]      = useState<TokenUsageSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!from || !to) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{ data: TokenUsageSummary }>(
        `/users/me/token-usage?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      );
      setData(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : '토큰 사용량을 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  return { data, isLoading, error, refetch: load };
}
