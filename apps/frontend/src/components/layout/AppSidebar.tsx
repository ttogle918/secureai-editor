'use client';
import { motion } from 'framer-motion';
import {
  Shield, Play, LayoutDashboard, Code2, Github, RefreshCw,
  FolderOpen, Loader2, ChevronDown, ChevronRight, Clock, AlertTriangle,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useSecureStore } from '@/store/useSecureStore';
import type { FileNode } from '@/lib/mockData';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useStartAnalysis } from '@/hooks/useStartAnalysis';
import { useProjects, type ProjectSummary } from '@/hooks/useProjects';

const FileTree = dynamic(() => import('@/components/editor/FileTree').then((m) => m.FileTree), {
  ssr: false,
});

const severityRank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

function injectVulnCount(nodes: FileNode[], map: Record<string, number>): FileNode[] {
  return nodes.map((n) => ({
    ...n,
    vulnCount: n.type === 'file' ? (map[n.path] ?? 0) : undefined,
    children: n.children ? injectVulnCount(n.children, map) : undefined,
  }));
}

function relativeTime(iso: string | null): string {
  if (!iso) return '분석 없음';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return '방금 전';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

function ProjectRow({
  project,
  active,
  onSelect,
}: {
  project: ProjectSummary;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        width: '100%', padding: '6px 10px',
        background: active ? 'rgba(249,115,22,0.1)' : 'transparent',
        border: 'none', borderRadius: 5,
        cursor: 'pointer', textAlign: 'left',
        transition: 'background 0.1s',
      }}
    >
      <div style={{
        width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
        background: project.vulnCount > 0 ? '#f04141' : '#22c55e',
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 11, fontWeight: 600,
          color: active ? '#f97316' : '#c8c8d0',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {project.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
          <Clock size={9} color="#555560" />
          <span style={{ fontSize: 9, color: '#555560', fontFamily: 'var(--font-mono)' }}>
            {relativeTime(project.lastAnalyzedAt)}
          </span>
          {project.vulnCount > 0 && (
            <>
              <span style={{ color: '#333340', fontSize: 9 }}>·</span>
              <AlertTriangle size={9} color="#f59e0b" />
              <span style={{ fontSize: 9, color: '#f59e0b', fontFamily: 'var(--font-mono)' }}>
                {project.vulnCount}
              </span>
            </>
          )}
        </div>
      </div>
    </button>
  );
}

function EmptyWorkspace({ onOpen, status, progress }: {
  onOpen: () => void;
  status: string;
  progress: string;
}) {
  const busy = status === 'reading' || status === 'uploading';
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px', gap: 14,
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: 14,
        background: 'rgba(249,115,22,0.06)',
        border: '1px dashed rgba(249,115,22,0.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <FolderOpen size={24} color="rgba(249,115,22,0.5)" />
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>
          폴더를 열어 시작하세요
        </div>
        <div style={{ fontSize: 10, color: '#444450', lineHeight: 1.6 }}>
          프로젝트 폴더를 선택하면<br />파일 트리와 보안 분석이<br />활성화됩니다
        </div>
      </div>
      <button
        onClick={onOpen}
        disabled={busy}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 18px', fontSize: 11, fontWeight: 700,
          background: busy ? 'rgba(249,115,22,0.1)' : 'rgba(249,115,22,0.15)',
          border: '1px solid rgba(249,115,22,0.35)',
          borderRadius: 8, color: '#f97316', cursor: busy ? 'not-allowed' : 'pointer',
          transition: 'all 0.15s',
        }}
      >
        {busy
          ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> {progress}</>
          : <><FolderOpen size={12} /> 폴더 열기</>}
      </button>
    </div>
  );
}

export function AppSidebar() {
  const sidebarOpen     = useSecureStore((s) => s.sidebarOpen);
  const sidebarWidth    = useSecureStore((s) => s.sidebarWidth);
  const viewMode        = useSecureStore((s) => s.viewMode);
  const setViewMode     = useSecureStore((s) => s.setViewMode);
  const selectedPath    = useSecureStore((s) => s.selectedPath);
  const setSelectedPath = useSecureStore((s) => s.setSelectedPath);
  const openTab         = useSecureStore((s) => s.openTab);
  const workspaceId     = useSecureStore((s) => s.workspaceId);
  const workspaceName   = useSecureStore((s) => s.workspaceName);
  const workspaceTree   = useSecureStore((s) => s.workspaceTree);
  const projectId       = useSecureStore((s) => s.projectId);
  const setProjectId    = useSecureStore((s) => s.setProjectId);
  const vulns           = useSecureStore((s) => s.vulns);

  const { startAnalysis, isAnalyzing } = useStartAnalysis();
  const { openFolder, status: wsStatus, progress: wsProgress } = useWorkspace();
  const { projects, loading: projectsLoading } = useProjects();

  const [projectsExpanded, setProjectsExpanded] = useState(true);

  const vulnCountMap: Record<string, number> = {};
  for (const v of vulns) {
    const rank = severityRank[v.severity] ?? 0;
    vulnCountMap[v.filePath] = Math.max(vulnCountMap[v.filePath] ?? 0, rank);
  }
  const tree = injectVulnCount(workspaceTree, vulnCountMap);

  const hasWorkspace = !!workspaceId && workspaceTree.length > 0;
  const busy = wsStatus === 'reading' || wsStatus === 'uploading';

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
      <div style={{
        padding: '13px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
      }}>
        <Shield size={15} color="#f97316" aria-hidden="true" />
        <span style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
          color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase',
        }}>
          SecureAI
        </span>
      </div>

      {/* ── 워크스페이스 열려있을 때만 상단에 작게 표시 ── */}
      {hasWorkspace && (
        <div style={{ padding: '8px 8px 4px', flexShrink: 0 }}>
          <button
            onClick={openFolder}
            disabled={busy}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, width: '100%',
              padding: '5px 10px', fontSize: 10, fontWeight: 600,
              background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.18)',
              borderRadius: 6, color: 'rgba(249,115,22,0.65)', cursor: busy ? 'not-allowed' : 'pointer',
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <FolderOpen size={11} />}
            {busy ? wsProgress : (workspaceName ?? '폴더 열기')}
          </button>
        </div>
      )}

      {/* ── 프로젝트 목록 ── */}
      {!projectsLoading && projects.length > 0 && (
        <div style={{ flexShrink: 0 }}>
          <button
            onClick={() => setProjectsExpanded((v) => !v)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', padding: '5px 12px 5px 12px',
              background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: projectsExpanded ? 'none' : '1px solid rgba(255,255,255,0.04)',
            }}
          >
            <span style={{
              fontSize: 9, color: 'rgba(255,255,255,0.2)',
              textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 700,
            }}>
              Projects
            </span>
            {projectsExpanded
              ? <ChevronDown size={11} color="rgba(255,255,255,0.2)" />
              : <ChevronRight size={11} color="rgba(255,255,255,0.2)" />}
          </button>

          {projectsExpanded && (
            <div style={{ padding: '3px 6px 6px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              {projects.map((p) => (
                <ProjectRow
                  key={p.id}
                  project={p}
                  active={p.id === projectId}
                  onSelect={() => setProjectId(p.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 파일 트리 or 빈 상태 ── */}
      {hasWorkspace ? (
        <>
          <div style={{
            padding: '5px 12px', fontSize: 9, color: 'rgba(255,255,255,0.18)',
            textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 700,
            borderBottom: '1px solid rgba(255,255,255,0.04)', flexShrink: 0,
          }}>
            {workspaceName ?? 'Workspace'}
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <FileTree
              tree={tree}
              selectedPath={selectedPath}
              onSelect={(p) => {
                setSelectedPath(p);
                openTab(p, p.split('/').pop() ?? p);
                setViewMode('editor');
              }}
            />
          </div>
        </>
      ) : (
        <EmptyWorkspace onOpen={openFolder} status={wsStatus} progress={wsProgress} />
      )}

      {/* ── 하단 액션 ── */}
      <div style={{
        padding: 10, borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0,
      }}>
        <button
          id="btn-sidebar-analyze"
          onClick={startAnalysis}
          disabled={isAnalyzing || !hasWorkspace}
          aria-label="전체 프로젝트 보안 분석 시작"
          style={{
            width: '100%', padding: '9px 0',
            background: isAnalyzing || !hasWorkspace ? '#1a1008' : '#ea580c',
            border: isAnalyzing || !hasWorkspace ? '1px solid rgba(255,255,255,0.06)' : 'none',
            borderRadius: 7,
            color: isAnalyzing || !hasWorkspace ? 'rgba(255,255,255,0.2)' : '#fff',
            fontSize: 11, fontWeight: 700,
            cursor: isAnalyzing || !hasWorkspace ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            boxShadow: isAnalyzing || !hasWorkspace ? 'none' : '0 3px 12px rgba(234,88,12,0.3)',
            transition: 'all 0.15s',
          }}
        >
          {isAnalyzing
            ? <><RefreshCw size={11} style={{ animation: 'spin 0.85s linear infinite' }} /> 분석 중...</>
            : <><Play size={11} /> 전체 프로젝트 분석</>}
        </button>

        <button
          onClick={() => setViewMode((v) => (v === 'editor' ? 'dashboard' : 'editor'))}
          style={{
            width: '100%', padding: '7px 0',
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 7, color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          }}
        >
          {viewMode === 'editor'
            ? <><LayoutDashboard size={11} /> 대시보드</>
            : <><Code2 size={11} /> 에디터</>}
        </button>

        <button
          style={{
            width: '100%', padding: '7px 0',
            background: 'transparent', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 7, color: 'rgba(255,255,255,0.3)', fontSize: 11,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          }}
        >
          <Github size={11} /> GitHub 연동
        </button>
      </div>
    </motion.aside>
  );
}
