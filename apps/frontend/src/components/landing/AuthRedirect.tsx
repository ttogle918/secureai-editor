'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';

/**
 * Electron 데스크탑 앱에서는 로그인 상태면 홈 진입 시 바로 /editor로 리다이렉트.
 * 웹 브라우저에서는 아무것도 하지 않음 (LandingNav에서 UI만 변경).
 * - _hasHydrated: Zustand persist의 onRehydrateStorage 완료 시점을 정확히 추적.
 */
export function AuthRedirect() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);

  useEffect(() => {
    if (!hasHydrated) return;

    // Electron 환경 감지
    const isElectron =
      typeof window !== 'undefined' &&
      (window.navigator.userAgent.includes('Electron') ||
        !!(window as unknown as Record<string, unknown>).electron);

    // Electron + 로그인 상태 → 에디터로 즉시 이동
    if (isElectron && user) {
      router.replace('/editor');
    }
  }, [hasHydrated, user, router]);

  return null;
}
