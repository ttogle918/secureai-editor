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
import { SastDashboardPage }         from '@/components/analysis/SastDashboardPage';
import { DastWorkspacePage }         from '@/components/analysis/DastWorkspacePage';
import { PatchManagerPage }          from '@/components/analysis/PatchManagerPage';
import ResizeHandle                  from '@/components/ui/ResizeHandle';
import { ToastContainer }            from '@/components/ui/Toast';
import { MobileBottomNav, type MobileScreen } from '@/components/layout/MobileBottomNav';
import { ChatFAB } from '@/components/analysis/ChatFAB';

// ── 분석 진행률 스트립 ────────────────────────────────────────────
function AnalysisProgressStrip() {
  const isAnalyzing   = useSecureStore((s) => s.isAnalyzing);
  const progressSteps = useSecureStore((s) => s.progressSteps);
  const lastTokenUsage = useSecureStore((s) => s.lastTokenUsage);

  // 현재 분석 중인 파일 (마지막 진행 중 스텝의 target)
  const runningStep = [...progressSteps].reverse().find((s) => s.status === 'running' || s.status === 'completed');
  const currentTarget = runningStep?.target ?? '';

  // SAST 완료/전체 카운트
  const completedCount = progressSteps.filter((s) => s.status === 'completed').length;
  const totalCount     = Math.max(progressSteps.length, 1);
  const pct = Math.round((completedCount / totalCount) * 100);

  const tokenStr = lastTokenUsage
    ? `${((lastTokenUsage.inputTokens + lastTokenUsage.outputTokens) / 1000).toFixed(1)}k tokens · $${lastTokenUsage.estimatedCostUsd.toFixed(4)}`
    : null;

  return (
    <div
      style={{
        height: isAnalyzing ? 28 : 0,
        flexShrink: 0,
        overflow: 'hidden',
        transition: 'height 0.25s ease',
        background: 'var(--bg-1)',
        borderBottom: isAnalyzing ? '1px solid var(--hairline)' : 'none',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: isAnalyzing ? '0 16px' : '0',
      }}
    >
      {isAnalyzing && (
        <>
          {/* 펄스 도트 + 텍스트 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', flexShrink: 0 }}>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: 'var(--orange)',
                display: 'inline-block',
                animation: 'pulse-dot 1.4s infinite',
              }}
            />
            분석 중 · SAST {completedCount}/{totalCount}
          </div>

          {/* 진행 바 */}
          <div style={{ flex: '0 1 320px', minWidth: 80 }}>
            <div style={{ height: 3, borderRadius: 2, background: 'var(--bg-3)', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  borderRadius: 2,
                  background: 'var(--orange-2)',
                  width: `${pct}%`,
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
          </div>

          {/* 현재 파일 */}
          {currentTarget && (
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
              현재: {currentTarget}
            </span>
          )}

          <div style={{ flex: 1 }} />

          {/* 토큰 사용량 */}
          {tokenStr && (
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
              {tokenStr}
            </span>
          )}
        </>
      )}
    </div>
  );
}

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
  const chatDockMode    = useSecureStore((s) => s.chatDockMode);

  const mobileScreen: MobileScreen = viewMode === 'dashboard' ? 'home' : 'vulns';
  const handleMobileNav = useCallback((screen: MobileScreen) => {
    if (screen === 'home') setViewMode('dashboard');
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
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        background: '#080809',
        color: '#e8e8ee',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* ── 메인 헤더 ── */}
      <div style={{ height: 48, flexShrink: 0 }}>
        <AppHeader onExportJSON={exportJSON} />
      </div>

      {/* 분석 진행률 스트립 — 분석 중일 때만 height:28, 아닐 때 height:0 */}
      <AnalysisProgressStrip />

      <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
        {/* AppSidebar는 항상 렌더링 — sidebarOpen=false면 슬림 레일(52px) 표시 */}
        <AppSidebar />

        {/* ResizeHandle은 풀 사이드바일 때만 */}
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
                <EditorLayout chatDocked={chatDockMode} />
              </motion.div>
            ) : viewMode === 'dashboard' ? (
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
            ) : viewMode === 'sast' ? (
              <motion.div
                key="sast"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}
              >
                <SastDashboardPage />
              </motion.div>
            ) : viewMode === 'dast' ? (
              <motion.div
                key="dast"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}
              >
                <DastWorkspacePage />
              </motion.div>
            ) : (
              <motion.div
                key="patch"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}
              >
                <PatchManagerPage />
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
      <ChatFAB />
    </div>
  );
}
