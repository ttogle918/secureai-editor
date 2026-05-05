// app/page.tsx
// "/" 진입점 — 컴포넌트 조합만 담당 (모든 로직은 컴포넌트에 위임)
'use client';
import { useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import { useSecureStore }           from '@/store/useSecureStore';
import { AppHeader }                from '@/components/layout/AppHeader';
import { AppSidebar }               from '@/components/layout/AppSidebar';
import { EditorLayout }             from '@/components/editor/EditorLayout';
import { AnalysisLoadingOverlay }   from '@/components/analysis/AnalysisLoadingOverlay';
import DashboardPage                from '@/components/dashboard/DashboardPage';
import ResizeHandle                 from '@/components/ui/ResizeHandle';
import { ToastContainer }           from '@/components/ui/Toast';

export default function HomePage() {
  const sidebarWidth     = useSecureStore((s) => s.sidebarWidth);
  const setSidebarWidth  = useSecureStore((s) => s.setSidebarWidth);
  const viewMode         = useSecureStore((s) => s.viewMode);
  const sidebarOpen      = useSecureStore((s) => s.sidebarOpen);
  const vulns            = useSecureStore((s) => s.vulns);

  const onSidebarResize = useCallback(
    (d: number) => setSidebarWidth((prev) => prev + d),
    [setSidebarWidth],
  );

  const exportJSON = useCallback(() => {
    const blob = new Blob(
      [JSON.stringify(
        { project: 'SecureAI Audit', timestamp: new Date().toISOString(), vulnerabilities: vulns },
        null, 2,
      )],
      { type: 'application/json' },
    );
    Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: 'security_audit.json',
    }).click();
  }, [vulns]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: '#080809',
        color: '#e8e8ee',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* ── 상단 헤더 ──────────────────────────────────── */}
      <div style={{ height: 48, flexShrink: 0 }}>
        <AppHeader onExportJSON={exportJSON} />
      </div>

      {/* ── 본문 (사이드바 + 메인) ──────────────────────── */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>

        {/* 사이드바 */}
        <AppSidebar />

        {/* 사이드바 리사이즈 핸들 */}
        {sidebarOpen && (
          <ResizeHandle onResize={onSidebarResize} direction="horizontal" />
        )}

        {/* 메인 뷰 */}
        <div style={{ flex: 1, display: 'flex', minWidth: 0, overflow: 'hidden' }}>
          <AnimatePresence mode="wait">
            {viewMode === 'editor' ? (
              <motion.div
                key="editor"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                style={{ flex: 1, display: 'flex', minWidth: 0, minHeight: 0 }}
              >
                <EditorLayout />
              </motion.div>
            ) : (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}
              >
                <DashboardPage />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── 분석 로딩 오버레이 ─────────────────────────── */}
      <AnalysisLoadingOverlay />

      {/* ── Toast 알림 ────────────────────────────────── */}
      <ToastContainer />
    </div>
  );
}
