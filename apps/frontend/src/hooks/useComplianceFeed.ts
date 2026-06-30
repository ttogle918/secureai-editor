'use client';
// hooks/useComplianceFeed.ts
// GET /api/v1/compliance/feed → 정부 권장사항·보안 뉴스·기관 게시물 피드 조회 훅.
// 컴포넌트 마운트 시 1회 fetch. 오류 발생 시 크래시하지 않고 에러 상태 반환 (skip & log).

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api/client';

// ── 백엔드 응답 타입 ──────────────────────────────────────────────────────────

export interface FeedFileAttachment {
  name: string;
  type: string;
  size: string;
}

export interface FeedItem {
  id: string;
  agency: string | null;
  category: string | null;
  source: string | null;
  title: string;
  summary: string | null;
  sourceUrl: string | null;
  /** ISO-8601 날짜 문자열 "YYYY-MM-DD" */
  publishedDate: string | null;
  files: FeedFileAttachment[];
  sortOrder: number;
}

export interface ComplianceFeedData {
  govRecommendations: FeedItem[];
  securityNews: FeedItem[];
  agencyPosts: FeedItem[];
}

interface ApiComplianceFeedResponse {
  data: ComplianceFeedData;
}

// ── 훅 ───────────────────────────────────────────────────────────────────────

export function useComplianceFeed() {
  const [data,      setData]      = useState<ComplianceFeedData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    (async () => {
      try {
        const res = await apiClient.get<ApiComplianceFeedResponse>('/compliance/feed');
        if (!cancelled) setData(res.data);
      } catch (e) {
        if (!cancelled) {
          // 피드 로딩 실패는 페이지 크래시 금지 — 에러 상태만 설정 (skip & log)
          // 에러 객체 전체(Axios config의 Authorization=JWT 포함 가능) 대신 message만 로깅
          const message = e instanceof Error ? e.message : '피드를 불러오지 못했습니다.';
          console.warn('[useComplianceFeed] 피드 로드 실패:', message);
          setError(message);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return { data, isLoading, error };
}
