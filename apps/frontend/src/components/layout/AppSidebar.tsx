// components/layout/AppSidebar.tsx
// 프로젝트 파일트리 사이드바
'use client';
import { motion } from 'framer-motion';
import { Shield, Play, LayoutDashboard, Code2, Github, RefreshCw } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useSecureStore } from '@/store/useSecureStore';
import { mockFileTree } from '@/lib/mockData';

// FileTree는 무거울 수 있으므로 lazy load
const FileTree = dynamic(() => import('@/components/editor/FileTree').then((m) => m.FileTree), {
  ssr: false,
});

export function AppSidebar() {
  const sidebarOpen     = useSecureStore((s) => s.sidebarOpen);
  const sidebarWidth    = useSecureStore((s) => s.sidebarWidth);
  const viewMode        = useSecureStore((s) => s.viewMode);
  const setViewMode     = useSecureStore((s) => s.setViewMode);
  const selectedPath    = useSecureStore((s) => s.selectedPath);
  const setSelectedPath = useSecureStore((s) => s.setSelectedPath);
  const isAnalyzing     = useSecureStore((s) => s.isAnalyzing);
  const startAnalysis   = useSecureStore((s) => s.startAnalysis);

  return (
    <motion.aside
      animate={{ width: sidebarOpen ? sidebarWidth : 0, opacity: sidebarOpen ? 1 : 0 }}
      transition={{ type: 'tween', duration: 0.15 }}
      style={{
        background: '#0f0f0f',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        flexShrink: 0,
      }}
      aria-label="파일 탐색기 사이드바"
    >
      {/* ── Logo ── */}
      <div
        style={{
          padding: '13px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <Shield size={15} color="#f97316" aria-hidden="true" />
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.12em',
            color: 'rgba(255,255,255,0.45)',
            textTransform: 'uppercase',
          }}
        >
          SecureAI
        </span>
      </div>

      {/* ── Section title ── */}
      <div
        style={{
          padding: '8px 12px 6px',
          fontSize: 10,
          color: 'rgba(255,255,255,0.2)',
          textTransform: 'uppercase',
          letterSpacing: '0.15em',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          flexShrink: 0,
        }}
      >
        프로젝트 파일 (MCP)
      </div>

      {/* ── File tree ── */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <FileTree
          tree={mockFileTree}
          selectedPath={selectedPath}
          onSelect={(p) => {
            setSelectedPath(p);
            setViewMode('editor');
          }}
        />
      </div>

      {/* ── Bottom actions ── */}
      <div
        style={{
          padding: 10,
          borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          flexShrink: 0,
        }}
      >
        {/* Analyze button */}
        <button
          id="btn-sidebar-analyze"
          onClick={startAnalysis}
          disabled={isAnalyzing}
          aria-label="전체 프로젝트 보안 분석 시작"
          style={{
            width: '100%',
            padding: '9px 0',
            background: '#ea580c',
            border: 'none',
            borderRadius: 7,
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
            cursor: isAnalyzing ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            boxShadow: '0 3px 12px rgba(234,88,12,0.3)',
            opacity: isAnalyzing ? 0.7 : 1,
            transition: 'all 0.15s',
          }}
        >
          {isAnalyzing
            ? <><RefreshCw size={11} aria-hidden="true" style={{ animation: 'spin 0.85s linear infinite' }} /> 분석 중...</>
            : <><Play size={11} aria-hidden="true" /> 전체 프로젝트 분석</>
          }
        </button>

        {/* Dashboard / Editor toggle */}
        <button
          onClick={() => setViewMode((v) => (v === 'editor' ? 'dashboard' : 'editor'))}
          aria-label={viewMode === 'editor' ? '대시보드로 전환' : '에디터로 전환'}
          style={{
            width: '100%',
            padding: '7px 0',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 7,
            color: 'rgba(255,255,255,0.55)',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 5,
            transition: 'all 0.15s',
          }}
        >
          {viewMode === 'editor'
            ? <><LayoutDashboard size={11} aria-hidden="true" /> 대시보드</>
            : <><Code2 size={11} aria-hidden="true" /> 에디터</>
          }
        </button>

        {/* GitHub link */}
        <button
          aria-label="GitHub 연동"
          style={{
            width: '100%',
            padding: '7px 0',
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 7,
            color: 'rgba(255,255,255,0.3)',
            fontSize: 11,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 5,
            transition: 'all 0.15s',
          }}
        >
          <Github size={11} aria-hidden="true" /> GitHub 연동
        </button>
      </div>
    </motion.aside>
  );
}
