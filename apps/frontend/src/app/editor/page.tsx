'use client';
import { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';

import { useAuthStore }              from '@/store/useAuthStore';
import { useSecureStore }            from '@/store/useSecureStore';
import { useLoadLatestResults }      from '@/hooks/useLoadLatestResults';
import { AppHeader }                 from '@/components/layout/AppHeader';
import { AppSidebar }                from '@/components/layout/AppSidebar';
import { EditorLayout }              from '@/components/editor/EditorLayout';
import { AnalysisLoadingOverlay }    from '@/components/analysis/AnalysisLoadingOverlay';
import DashboardPage                 from '@/components/dashboard/DashboardPage';
import ResizeHandle                  from '@/components/ui/ResizeHandle';
import { ToastContainer }            from '@/components/ui/Toast';
import { MobileBottomNav, type MobileScreen } from '@/components/layout/MobileBottomNav';

export default function EditorPage() {
  const router        = useRouter();
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const user          = useAuthStore((s) => s.user);

  useLoadLatestResults();

  // auth guard: initAuth 완료 후 미로그인이면 로그인 페이지로
  useEffect(() => {
    if (isInitialized && !user) {
      router.replace('/login');
    }
  }, [isInitialized, user, router]);

  const sidebarWidth    = useSecureStore((s) => s.sidebarWidth);
  const setSidebarWidth = useSecureStore((s) => s.setSidebarWidth);
  const viewMode        = useSecureStore((s) => s.viewMode);
  const setViewMode     = useSecureStore((s) => s.setViewMode);
  const sidebarOpen     = useSecureStore((s) => s.sidebarOpen);
  const vulns           = useSecureStore((s) => s.vulns);

  const mobileScreen: MobileScreen = viewMode === 'dashboard' ? 'dashboard' : 'vulns';
  const handleMobileNav = useCallback((screen: MobileScreen) => {
    if (screen === 'dashboard') setViewMode('dashboard');
    else setViewMode('editor');
  }, [setViewMode]);

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

  // initAuth 진행 중이거나 미로그인 → 빈 화면 (redirect 진행 중)
  if (!isInitialized || !user) {
    return (
      <div style={{
        height: '100vh',
        background: '#080809',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13, fontFamily: 'var(--font-mono)' }}>
          로딩 중...
        </div>
      </div>
    );
  }

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
      <div style={{ height: 48, flexShrink: 0 }}>
        <AppHeader onExportJSON={exportJSON} />
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
        <AppSidebar />

        {sidebarOpen && (
          <ResizeHandle onResize={onSidebarResize} direction="horizontal" />
        )}

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

      <AnalysisLoadingOverlay />
      <ToastContainer />
      <div className="mobile-only">
        <MobileBottomNav activeScreen={mobileScreen} onNavigate={handleMobileNav} />
      </div>
    </div>
  );
}
