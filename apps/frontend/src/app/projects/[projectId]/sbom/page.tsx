'use client';
// app/projects/[projectId]/sbom/page.tsx
// SBOM 컴포넌트 조회 독립 페이지.
// projectId는 URL 파라미터, sessionId는 쿼리 파라미터로 전달받는다.

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useSecureStore } from '@/store/useSecureStore';
import { SbomPage } from '@/components/analysis/SbomPage';

export default function SbomRoute() {
  const params           = useParams<{ projectId: string }>();
  const setProjectId     = useSecureStore((s) => s.setProjectId);
  const workspaceProjects = useSecureStore((s) => s.workspaceProjects);

  // URL의 projectId를 스토어에 동기화 (RightPanel의 SbomPage와 동일한 데이터 소스 사용)
  useEffect(() => {
    if (params.projectId) {
      setProjectId(params.projectId);
    }
  }, [params.projectId, setProjectId]);

  const project = workspaceProjects.find((p) => p.id === params.projectId);

  return (
    <div style={{ height: '100vh', overflow: 'hidden' }}>
      <SbomPage projectName={project?.name ?? params.projectId} />
    </div>
  );
}
