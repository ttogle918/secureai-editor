'use client';
import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { initAuth } = useAuth();
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    called.current = true;
    initAuth();
  }, [initAuth]);

  return <>{children}</>;
}
