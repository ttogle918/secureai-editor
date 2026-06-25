'use client';
// hooks/useCredits.ts
// /users/me/credits 로 실제 크레딧 잔액·플랜 정보를 조회한다.
// 컴포넌트 마운트 시 1회 fetch. 로그인 상태가 아니면 null 반환.
import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/store/useAuthStore';

export interface CreditsData {
  balance: number;
  hasByok: boolean;
  preferredModel: string;
  plan: {
    name: string;
    displayName: string;
    allowDast: boolean;
    allowMonitoring: boolean;
  };
}

interface ApiCreditsResponse {
  balance: number;
  hasByok: boolean;
  preferredModel: string;
}

interface ApiMeResponse {
  id: string;
  plan: {
    name: string;
    displayName: string;
    allowDast: boolean;
    allowMonitoring: boolean;
  };
  credits: {
    balance: number;
    hasByok: boolean;
    preferredModel: string;
  };
}

export function useCredits() {
  const user = useAuthStore((s) => s.user);
  const [data, setData]       = useState<CreditsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    // /users/me 우선, 실패 시 /users/me/credits 폴백.
    // 폴백을 await 안에서 처리해 두 경로가 모두 끝난 뒤 finally에서 로딩 해제한다.
    (async () => {
      try {
        const res = await apiClient.get<{ data: ApiMeResponse }>('/users/me');
        if (cancelled) return;
        const u = res.data;
        setData({
          balance: u.credits.balance,
          hasByok: u.credits.hasByok,
          preferredModel: u.credits.preferredModel,
          plan: {
            name:             u.plan.name,
            displayName:      u.plan.displayName,
            allowDast:        u.plan.allowDast,
            allowMonitoring:  u.plan.allowMonitoring,
          },
        });
      } catch {
        try {
          const res = await apiClient.get<{ data: ApiCreditsResponse }>('/users/me/credits');
          if (cancelled) return;
          setData({
            balance:        res.data.balance,
            hasByok:        res.data.hasByok,
            preferredModel: res.data.preferredModel,
            plan: {
              name:             user.plan,
              displayName:      user.plan,
              allowDast:        false,
              allowMonitoring:  false,
            },
          });
        } catch {
          if (!cancelled) setError('크레딧 정보를 불러오지 못했습니다.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user]);

  return { data, isLoading, error };
}
