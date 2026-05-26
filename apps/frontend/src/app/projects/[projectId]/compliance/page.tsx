'use client';
// app/projects/[projectId]/compliance/page.tsx
// 컴플라이언스 프레임워크 매핑 독립 페이지.
// projectId는 URL 파라미터, sessionId(lockedSessionId)는 Zustand 스토어에서 참조.

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useSecureStore } from '@/store/useSecureStore';
import { CompliancePage } from '@/components/compliance/CompliancePage';

export default function ComplianceRoute() {
  const params       = useParams<{ projectId: string }>();
  const setProjectId = useSecureStore((s) => s.setProjectId);

  // URL의 projectId를 스토어에 동기화
  useEffect(() => {
    if (params.projectId) {
      setProjectId(params.projectId);
    }
  }, [params.projectId, setProjectId]);

  return (
    <div style={{ height: '100vh', overflow: 'hidden' }}>
      <CompliancePage />
    </div>
  );
}
