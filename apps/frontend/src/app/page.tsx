'use client';
import { useCallback } from 'react';
import dynamic from 'next/dynamic';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Shield, Play, RefreshCw, LayoutDashboard, Code,
  ChevronRight, FileJson, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';

import { useSecureStore, type SeverityFilter } from '@/store/useSecureStore';
import { mockFileTree, mockFileContents } from '@/lib/mockData';

import FileTree        from '@/components/editor/FileTree';
import DastTerminal    from '@/components/analysis/DastTerminal';
import ChatPanel       from '@/components/analysis/ChatPanel';
import VulnDetailPanel from '@/components/analysis/VulnDetailPanel';
import FilterBar       from '@/components/ui/FilterBar';
import ResizeHandle    from '@/components/ui/ResizeHandle';
import DashboardPage   from '@/components/dashboard/DashboardPage';

const MonacoEditor = dynamic(() => import('@/components/editor/CodeEditor'), { ssr: false });

// ── 헤더 심각도 필터 버튼 ────────────────────────────────────
const SEV_META: { value: SeverityFilter; label: string; color: string }[] = [
  { value: 'critical', label: 'Critical', color: '#E24B4A' },
  { value: 'high',     label: 'High',     color: '#BA7517' },
  { value: 'medium',   label: 'Medium',   color: '#4ec9b0' },
  { value: 'low',      label: 'Low',      color: '#608b4e' },
];

export default function HomePage() {
  // ── 스토어 ───────────────────────────────────────────────
  const viewMode           = useSecureStore(s => s.viewMode);
  const setViewMode        = useSecureStore(s => s.setViewMode);
  const selectedPath       = useSecureStore(s => s.selectedPath);
  const setSelectedPath    = useSecureStore(s => s.setSelectedPath);
  const sidebarOpen        = useSecureStore(s => s.sidebarOpen);
  const setSidebarOpen     = useSecureStore(s => s.setSidebarOpen);
  const rightTab           = useSecureStore(s => s.rightTab);
  const setRightTab        = useSecureStore(s => s.setRightTab);
  const sidebarWidth       = useSecureStore(s => s.sidebarWidth);
  const setSidebarWidth    = useSecureStore(s => s.setSidebarWidth);
  const rightPanelWidth    = useSecureStore(s => s.rightPanelWidth);
  const setRightPanelWidth = useSecureStore(s => s.setRightPanelWidth);
  const terminalHeight     = useSecureStore(s => s.terminalHeight);
  const setTerminalHeight  = useSecureStore(s => s.setTerminalHeight);
  const isAnalyzing        = useSecureStore(s => s.isAnalyzing);
  const startAnalysis      = useSecureStore(s => s.startAnalysis);
  const chatMessages       = useSecureStore(s => s.chatMessages);
  const sendChat           = useSecureStore(s => s.sendChat);
  const dastLogs           = useSecureStore(s => s.dastLogs);
  const vulns              = useSecureStore(s => s.vulns);
  const severityFilter     = useSecureStore(s => s.severityFilter);
  const setSeverityFilter  = useSecureStore(s => s.setSeverityFilter);

  // ── 파생 ─────────────────────────────────────────────────
  const code      = mockFileContents[selectedPath] ?? '// 파일을 선택하세요';
  const lang      = selectedPath.endsWith('.java') ? 'java'
                  : selectedPath.endsWith('.tsx') || selectedPath.endsWith('.ts') ? 'typescript'
                  : selectedPath.endsWith('.properties') ? 'ini' : 'plaintext';
  const fileVulns = vulns.filter(v => v.filePath === selectedPath);

  // ── 리사이즈 핸들러 ──────────────────────────────────────
  const onSidebarResize    = useCallback((d: number) => setSidebarWidth(sidebarWidth + d),       [sidebarWidth, setSidebarWidth]);
  const onRightResize      = useCallback((d: number) => setRightPanelWidth(rightPanelWidth - d), [rightPanelWidth, setRightPanelWidth]);
  const onTerminalResize   = useCallback((d: number) => setTerminalHeight(terminalHeight - d),   [terminalHeight, setTerminalHeight]);

  // ── Export JSON ──────────────────────────────────────────
  const exportJSON = useCallback(() => {
    const blob = new Blob(
      [JSON.stringify({ project: 'SecureAI Audit', timestamp: new Date().toISOString(), vulnerabilities: vulns }, null, 2)],
      { type: 'application/json' }
    );
    Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'security_audit.json' }).click();
  }, [vulns]);

  // ── 헤더 심각도 필터 클릭 핸들러 ────────────────────────
  const handleSevFilter = (sev: SeverityFilter) => {
    setSeverityFilter(severityFilter === sev ? 'all' : sev);
  };

  // ════════════════════════════════════════════════════════
  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0a0a0a', color: '#e5e5e5', overflow: 'hidden', userSelect: 'none' }}>

      {/* ══ 사이드바 ════════════════════════════════════════ */}
      <motion.aside
        animate={{ width: sidebarOpen ? sidebarWidth : 0, opacity: sidebarOpen ? 1 : 0 }}
        transition={{ type: 'tween', duration: 0.15 }}
        style={{ background: '#0f0f0f', borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}
      >
        {/* 로고 */}
        <div style={{ padding: '13px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <Shield size={15} color="#f97316" />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase' }}>
            SecureAI
          </span>
        </div>

        {/* 파일 트리 */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <FileTree
            tree={mockFileTree}
            selectedPath={selectedPath}
            onSelect={p => { setSelectedPath(p); setViewMode('editor'); }}
          />
        </div>

        {/* 하단 버튼 */}
        <div style={{ padding: 10, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
          <button
            onClick={startAnalysis}
            disabled={isAnalyzing}
            style={{ width: '100%', padding: '9px 0', background: '#ea580c', border: 'none', borderRadius: 7, color: '#fff', fontSize: 11, fontWeight: 700, cursor: isAnalyzing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, boxShadow: '0 3px 12px rgba(234,88,12,0.3)', opacity: isAnalyzing ? 0.7 : 1 }}
          >
            {isAnalyzing ? <RefreshCw size={11} style={{ animation: 'spin 0.85s linear infinite' }} /> : <Play size={11} />}
            전체 프로젝트 분석
          </button>
          <button
            onClick={() => setViewMode(v => v === 'editor' ? 'dashboard' : 'editor')}
            style={{ width: '100%', padding: '7px 0', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 7, color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
          >
            {viewMode === 'editor'
              ? <><LayoutDashboard size={11} /> 대시보드</>
              : <><Code size={11} /> 에디터</>}
          </button>
        </div>
      </motion.aside>

      {/* 사이드바 리사이즈 핸들 */}
      {sidebarOpen && <ResizeHandle onResize={onSidebarResize} direction="horizontal" />}

      {/* ══ 메인 영역 ══════════════════════════════════════ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* ─ 상단 헤더 ─────────────────────────────────── */}
        <header style={{
          height: 44, borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 14px', flexShrink: 0, zIndex: 10,
        }}>
          {/* 왼쪽: 사이드바 토글 + 경로 + 파이프라인 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => setSidebarOpen(v => !v)}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', display: 'flex', padding: 4, borderRadius: 5 }}
              title={sidebarOpen ? '사이드바 닫기' : '사이드바 열기'}
            >
              {sidebarOpen ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.3)' }}>
              <span>SecureAI</span>
              <ChevronRight size={11} />
              <span style={{ color: 'rgba(255,255,255,0.75)' }}>
                {viewMode === 'editor' ? selectedPath.split('/').pop() : 'Security Dashboard'}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 4, marginLeft: 4 }}>
              {[
                { l: '✓ SAST', done: true  },
                { l: '→ DAST', active: true },
                { l: '패치'                 },
              ].map((s, i) => (
                <span key={i} style={{
                  fontSize: 10, padding: '2px 8px', borderRadius: 20,
                  border: '0.5px solid rgba(255,255,255,0.1)',
                  color:      s.done ? '#4caf50' : s.active ? '#e2a53a' : 'rgba(255,255,255,0.2)',
                  background: s.done ? 'rgba(76,175,80,0.08)' : s.active ? 'rgba(226,165,58,0.08)' : 'transparent',
                }}>
                  {s.l}
                </span>
              ))}
            </div>
          </div>

          {/* 오른쪽: 심각도 필터 클릭 버튼 + Export */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* ALL 버튼 */}
            <button
              onClick={() => setSeverityFilter('all')}
              style={{
                fontSize: 10, padding: '3px 9px', borderRadius: 4, fontWeight: 700,
                background: severityFilter === 'all' ? 'rgba(255,255,255,0.12)' : 'transparent',
                color: severityFilter === 'all' ? '#fff' : 'rgba(255,255,255,0.3)',
                border: `0.5px solid ${severityFilter === 'all' ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.08)'}`,
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              ALL
            </button>

            {SEV_META.map(({ value, label, color }) => {
              const cnt    = vulns.filter(v => v.severity === value).length;
              const active = severityFilter === value;
              return (
                <button
                  key={value}
                  onClick={() => handleSevFilter(value)}
                  title={`${label} 취약점만 보기`}
                  style={{
                    fontSize: 10, padding: '3px 9px', borderRadius: 4, fontWeight: 700,
                    background: active ? `${color}20` : 'transparent',
                    color:      active ? color : 'rgba(255,255,255,0.35)',
                    border:     `0.5px solid ${active ? `${color}50` : 'rgba(255,255,255,0.08)'}`,
                    cursor: 'pointer', transition: 'all 0.15s',
                    boxShadow: active ? `0 0 8px ${color}30` : 'none',
                  }}
                >
                  {label} ×{cnt}
                </button>
              );
            })}

            <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)', margin: '0 2px' }} />

            <button
              onClick={exportJSON}
              style={{ fontSize: 10, background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, letterSpacing: '0.06em', padding: '4px 6px', borderRadius: 4, transition: 'color 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.25)')}
            >
              <FileJson size={12} /> Export JSON
            </button>
          </div>
        </header>

        {/* ─ 본문 ──────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
          <AnimatePresence mode="wait">

            {viewMode === 'editor' ? (
              /* ══ 에디터 뷰 ════════════════════════════════ */
              <motion.div
                key="editor"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ flex: 1, display: 'flex', minWidth: 0 }}
              >
                {/* 코드 + 터미널 */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
                  {/* 파일 탭 */}
                  <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#141414', flexShrink: 0 }}>
                    <div style={{ padding: '7px 18px', fontSize: 12, color: '#fff', borderBottom: '1.5px solid #ea580c', background: '#0d0d0d', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                      {selectedPath.split('/').pop()}
                    </div>
                  </div>

                  {/* Monaco 에디터 */}
                  <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
                    <MonacoEditor value={code} language={lang} vulnerabilities={fileVulns} />
                  </div>

                  {/* 터미널 리사이즈 핸들 */}
                  <ResizeHandle onResize={onTerminalResize} direction="vertical" />

                  {/* DAST 터미널 */}
                  <div style={{ height: terminalHeight, flexShrink: 0, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <DastTerminal logs={dastLogs} />
                  </div>
                </div>

                {/* 오른쪽 리사이즈 핸들 */}
                <ResizeHandle onResize={onRightResize} direction="horizontal" />

                {/* ─ 오른쪽 패널 ────────────────────────── */}
                <div style={{ width: rightPanelWidth, flexShrink: 0, background: '#0f0f0f', borderLeft: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                  {/* 탭 헤더 */}
                  <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#141414', flexShrink: 0 }}>
                    {(['vulns', 'chat'] as const).map(tab => (
                      <button
                        key={tab}
                        onClick={() => setRightTab(tab)}
                        style={{
                          flex: 1, padding: '8px 0', fontSize: 11, fontWeight: 600,
                          background: 'none', border: 'none',
                          borderBottom: rightTab === tab ? '1.5px solid #ea580c' : '1.5px solid transparent',
                          color: rightTab === tab ? '#fff' : 'rgba(255,255,255,0.28)',
                          cursor: 'pointer',
                        }}
                      >
                        {tab === 'vulns' ? `취약점 (${fileVulns.length})` : '💬 AI 채팅'}
                      </button>
                    ))}
                  </div>

                  {rightTab === 'vulns' ? (
                    <>
                      {/* API 그룹 필터 */}
                      <FilterBar />
                      {/* 취약점 상세 토글 목록 (수정 가능) */}
                      <VulnDetailPanel />
                    </>
                  ) : (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                      <ChatPanel messages={chatMessages} onSend={sendChat} />
                    </div>
                  )}
                </div>
              </motion.div>

            ) : (
              /* ══ 대시보드 뷰 ══════════════════════════════ */
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, overflow: 'hidden' }}
              >
                <DashboardPage />
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>

      {/* ══ 분석 로딩 오버레이 ══════════════════════════════ */}
      <AnimatePresence>
        {isAnalyzing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22 }}
          >
            <div style={{ position: 'relative', width: 68, height: 68 }}>
              <div style={{ position: 'absolute', inset: 0, border: '3px solid rgba(234,88,12,0.18)', borderRadius: '50%' }} />
              <div style={{ position: 'absolute', inset: 0, border: '3px solid transparent', borderTopColor: '#ea580c', borderRadius: '50%', animation: 'spin 0.85s linear infinite' }} />
              <Shield size={26} color="#f97316" style={{ position: 'absolute', inset: 0, margin: 'auto' }} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 19, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>AI 보안 감사 진행 중</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 5 }}>API 호출 체인 및 취약점 전체 분석 중...</div>
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
