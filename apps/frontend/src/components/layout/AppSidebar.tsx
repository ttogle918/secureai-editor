'use client';
import { motion } from 'framer-motion';
import {
  Shield, LayoutDashboard, Code2,
  FolderOpen, FolderCode, Loader2, ChevronDown, ChevronRight, Clock, AlertTriangle, X,
  CheckCircle, Download, Github, Rocket,
  ShieldAlert, Package, History, Users, Settings,
  Link2, FileText, ClipboardList, Clock3, Activity, UserCog, FileSearch,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useSecureStore } from '@/store/useSecureStore';
import { useToastStore } from '@/hooks/useToast';
import { apiClient } from '@/lib/api/client';
import type { FileNode, Vulnerability } from '@/lib/mockData';
import type { Severity, VulnCategory } from '@/lib/mockData';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useProjects, type ProjectSummary } from '@/hooks/useProjects';
import { deriveApiGroup } from '@/lib/vulnUtils';
import { useAuthStore } from '@/store/useAuthStore';
import { useTranslation } from '@/hooks/useTranslation';
import { PdfReportModal } from '@/components/analysis/PdfReportModal';
import { SecurityDocPage } from '@/components/analysis/SecurityDocPage';

const VALID_SEV: Severity[] = ['critical', 'high', 'medium', 'low'];
const VALID_CAT: VulnCategory[] = ['SECURITY', 'CODE_QUALITY'];

// ── 그룹 테마 색상 상수 ──────────────────────────────────────────
const GROUP_COLORS = {
  core:       'rgba(255,255,255,0.3)',
  security:   '#569cd6',
  automation: '#a78bfa',
  reports:    '#34d399',
  settings:   'rgba(255,255,255,0.25)',
} as const;

const NEW_BADGE_BG    = 'rgba(245,158,11,0.12)';
const NEW_BADGE_COLOR = '#f59e0b';

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

function buildVirtualTree(vulns: Vulnerability[]): FileNode[] {
  if (vulns.length === 0) return [];

  const fileMap: Record<string, number> = {};
  for (const v of vulns) {
    const rank = severityRank[v.severity] ?? 0;
    fileMap[v.filePath] = Math.max(fileMap[v.filePath] ?? 0, rank);
  }

  type Branch = { [key: string]: number | Branch };
  const root: Branch = {};

  for (const [path, rank] of Object.entries(fileMap)) {
    const parts = path.split('/').filter(Boolean);
    let cur = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const seg = parts[i];
      if (typeof cur[seg] !== 'object') cur[seg] = {};
      cur = cur[seg] as Branch;
    }
    const fileName = parts[parts.length - 1] ?? path;
    cur[fileName] = rank;
  }

  function toNodes(branch: Branch, prefix: string): FileNode[] {
    return Object.entries(branch)
      .map(([name, val]) => {
        const path = prefix ? `${prefix}/${name}` : name;
        if (typeof val === 'number') {
          return { type: 'file' as const, name, path, vulnCount: val };
        }
        return { type: 'dir' as const, name, path, children: toNodes(val as Branch, path) };
      })
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }

  return toNodes(root, '');
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

// ── VS Code 스타일 워크스페이스 루트 섹션 ────────────────────────────
function WorkspaceRoot({
  icon, iconColor, name, tree, selectedPath, onSelect, onClose, subtitle, expanded, onToggle,
}: {
  icon: React.ReactNode;
  iconColor: string;
  name: string;
  tree: FileNode[];
  selectedPath: string;
  onSelect: (path: string) => void;
  onClose?: () => void;
  subtitle?: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div>
      {/* 루트 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '3px 4px 3px 6px' }}>
        <button
          onClick={onToggle}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: 5, minWidth: 0,
            background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
            padding: '3px 4px', borderRadius: 4,
          }}
        >
          {expanded
            ? <ChevronDown size={10} color="rgba(255,255,255,0.3)" />
            : <ChevronRight size={10} color="rgba(255,255,255,0.3)" />}
          {icon}
          <span style={{
            fontSize: 10, fontWeight: 700, color: iconColor,
            textTransform: 'uppercase', letterSpacing: '0.08em',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {name}
          </span>
          {subtitle && (
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', fontStyle: 'italic', flexShrink: 0 }}>
              {subtitle}
            </span>
          )}
        </button>
        {onClose && (
          <button
            onClick={onClose}
            title="워크스페이스에서 제거"
            style={{
              flexShrink: 0, padding: '3px 5px', marginRight: 2,
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(255,255,255,0.18)', borderRadius: 3, display: 'flex',
            }}
          >
            <X size={10} />
          </button>
        )}
      </div>

      {/* 파일 트리 */}
      {expanded && tree.length > 0 && (
        <div style={{ paddingLeft: 12 }}>
          <FileTree tree={tree} selectedPath={selectedPath} onSelect={onSelect} />
        </div>
      )}
      {expanded && tree.length === 0 && (
        <div style={{ padding: '4px 24px 6px', fontSize: 10, color: 'rgba(255,255,255,0.18)' }}>
          파일 없음
        </div>
      )}
    </div>
  );
}

// ── 컨텍스트 메뉴 ────────────────────────────────────────────────
interface CtxMenu { project: ProjectSummary; x: number; y: number }

function ProjectContextMenu({
  menu, onActivate, onLoadLatest, onClose,
}: {
  menu: CtxMenu;
  onActivate: (p: ProjectSummary) => void;
  onLoadLatest: (p: ProjectSummary) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const itemStyle: React.CSSProperties = {
    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
    padding: '7px 12px', background: 'none', border: 'none',
    cursor: 'pointer', textAlign: 'left', fontSize: 12,
    color: 'rgba(255,255,255,0.8)', borderRadius: 4,
    transition: 'background 0.1s',
  };

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed', left: menu.x, top: menu.y, zIndex: 9000,
        background: '#1c1c1f', border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 8, padding: 4, minWidth: 180,
        boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
      }}
    >
      <div style={{ padding: '4px 12px 6px', fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 700 }}>
        {menu.project.name}
      </div>
      <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '0 4px 4px' }} />
      <button
        style={itemStyle}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(249,115,22,0.1)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
        onClick={() => { onActivate(menu.project); onClose(); }}
      >
        <CheckCircle size={13} color="#f97316" />
        {t('sidebar.set_active_project', '활성 프로젝트로 설정')}
      </button>
      <button
        style={itemStyle}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
        onClick={() => { onLoadLatest(menu.project); onClose(); }}
      >
        <Download size={13} color="rgba(255,255,255,0.5)" />
        {t('sidebar.load_latest_results', '최신 분석 결과 불러오기')}
      </button>
    </div>
  );
}

// ── API 프로젝트 행 ────────────────────────────────────────────────
function ProjectRow({
  project, active, onSelect, onContextMenu,
}: {
  project: ProjectSummary;
  active: boolean;
  onSelect: () => void;
  onContextMenu: (e: React.MouseEvent, p: ProjectSummary) => void;
}) {
  return (
    <button
      onClick={onSelect}
      onContextMenu={(e) => onContextMenu(e, project)}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 7,
        padding: '5px 12px 5px 10px',
        background: active ? 'rgba(249,115,22,0.1)' : 'transparent',
        border: 'none', borderRadius: 5, cursor: 'pointer', textAlign: 'left',
        transition: 'background 0.1s', minWidth: 0,
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

// ── 빈 초기 상태 ──────────────────────────────────────────────────
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
        }}
      >
        {busy
          ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> {progress}</>
          : <><FolderOpen size={12} /> 폴더 열기</>}
      </button>
    </div>
  );
}

// ── 슬림 레일 (52px) — sidebarOpen=false 시 표시 ──────────────────
function SlimRail({
  vulnCount, openTabCount, onExpand,
}: {
  vulnCount: number;
  openTabCount: number;
  onExpand: () => void;
}) {
  const { user: authUser } = useAuthStore();
  const initials = authUser
    ? (authUser.displayName ?? authUser.username ?? authUser.email ?? '?')
        .split(' ')
        .map((w) => w[0]?.toUpperCase() ?? '')
        .slice(0, 2)
        .join('')
    : '??';

  const baseNavItems = [
    { icon: <FolderOpen size={16} />, label: '파일',        active: true,  badge: openTabCount },
    { icon: <ShieldAlert size={16} />, label: '취약점',     active: false, badge: vulnCount > 0 ? vulnCount : 0 },
    { icon: <Package size={16} />,    label: 'SBOM',        active: false, badge: 0 },
    { icon: <History size={16} />,    label: '이력',        active: false, badge: 0 },
    { icon: <Link2 size={16} />,      label: '시크릿 스캔', active: false, badge: 0 },
    { icon: <ClipboardList size={16} />, label: '컴플라이언스', active: false, badge: 0 },
    { icon: <FileText size={16} />,   label: '보고서',      active: false, badge: 0 },
    { icon: <Users size={16} />,      label: '팀',          active: false, badge: 0 },
    { icon: <Settings size={16} />,   label: '설정',        active: false, badge: 0 },
  ];
  // 페르소나별 메뉴 분기 (TASK-1102) — 보안 담당은 보안 관점(취약점·SBOM)을 상단 강조
  const navItems = authUser?.workspaceMode === 'SECURITY_MANAGER'
    ? [baseNavItems[1], baseNavItems[2], baseNavItems[4], baseNavItems[5], baseNavItems[6], baseNavItems[0], baseNavItems[3], baseNavItems[7], baseNavItems[8]]
    : baseNavItems;

  return (
    <div
      style={{
        width: 52,
        flexShrink: 0,
        background: '#0f0f0f',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '10px 0',
        gap: 4,
        overflow: 'hidden',
      }}
      aria-label="워크스페이스 슬림 레일"
    >
      {navItems.map((item, i) => (
        <button
          key={i}
          title={item.label}
          onClick={item.active ? undefined : onExpand}
          style={{
            position: 'relative',
            width: 36,
            height: 36,
            borderRadius: 8,
            background: item.active ? 'var(--orange-dim)' : 'transparent',
            color: item.active ? 'var(--orange)' : 'rgba(255,255,255,0.35)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.12s, color 0.12s',
          }}
        >
          {item.icon}
          {item.badge > 0 && (
            <span
              style={{
                position: 'absolute',
                top: 3,
                right: 3,
                minWidth: 13,
                height: 13,
                borderRadius: 7,
                background: 'var(--critical)',
                color: '#fff',
                fontSize: 8,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 3px',
              }}
            >
              {item.badge > 99 ? '99+' : item.badge}
            </span>
          )}
        </button>
      ))}

      <div style={{ flex: 1 }} />

      {/* 확장 버튼 */}
      <button
        onClick={onExpand}
        title="사이드바 펼치기"
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: 'transparent',
          border: 'none',
          color: 'rgba(255,255,255,0.3)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'color 0.12s',
        }}
      >
        <ChevronRight size={14} />
      </button>

      {/* 아바타 */}
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: 8,
          background: 'linear-gradient(135deg, rgba(129,140,248,0.8), rgba(99,102,241,0.9))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 10,
          fontWeight: 700,
          color: '#fff',
          userSelect: 'none',
        }}
        title={authUser?.displayName ?? authUser?.username ?? ''}
      >
        {initials || '?'}
      </div>
    </div>
  );
}

// ── 네비 그룹 구분선 ──────────────────────────────────────────────
function NavGroupLabel({ label, color, isNew }: { label: string; color: string; isNew?: boolean }) {
  return (
    <div style={{
      padding: '10px 14px 3px',
      display: 'flex', alignItems: 'center', gap: 6,
      borderTop: '1px solid rgba(255,255,255,0.06)',
      marginTop: 4,
    }}>
      <span style={{
        fontSize: 9, fontWeight: 700, color,
        fontFamily: 'var(--font-mono)', letterSpacing: '0.12em',
        textTransform: 'uppercase',
      }}>
        {label}
      </span>
      {isNew && (
        <span style={{
          fontSize: 8, padding: '1px 4px', borderRadius: 2,
          background: NEW_BADGE_BG, color: NEW_BADGE_COLOR,
          fontFamily: 'var(--font-mono)', fontWeight: 700,
        }}>
          NEW
        </span>
      )}
    </div>
  );
}

// ── 네비 항목 (버튼/링크 공통) ────────────────────────────────────
interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  badge?: number;
  active?: boolean;
  disabled?: boolean;
  disabledTooltip?: string;
  onClick?: () => void;
  color?: string;
  /** 태그 배지 (예: CISO) */
  tag?: string;
}

function NavItem({ icon, label, badge, active, disabled, disabledTooltip, onClick, color, tag }: NavItemProps) {
  const [hovered, setHovered] = useState(false);

  const handleClick = () => {
    if (disabled) return;
    onClick?.();
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      aria-disabled={disabled}
      title={disabled ? (disabledTooltip ?? '준비 중') : label}
      aria-label={disabled ? `${label} — ${disabledTooltip ?? '준비 중'}` : label}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 9,
        padding: '7px 14px',
        background: active ? 'rgba(249,115,22,0.08)' : hovered && !disabled ? 'rgba(255,255,255,0.04)' : 'transparent',
        border: 'none',
        borderLeft: active ? '2px solid #f97316' : '2px solid transparent',
        cursor: disabled ? 'default' : 'pointer',
        textAlign: 'left',
        opacity: disabled ? 0.4 : 1,
        transition: 'background 0.1s',
        marginBottom: 0,
      }}
    >
      <span style={{ color: disabled ? 'rgba(255,255,255,0.3)' : (color ?? 'var(--text-secondary)'), flexShrink: 0, display: 'flex' }}>
        {icon}
      </span>
      <span style={{
        fontSize: 12, color: active ? '#f97316' : disabled ? 'rgba(255,255,255,0.3)' : 'var(--text-secondary)',
        fontWeight: active ? 600 : 400,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1,
      }}>
        {label}
      </span>
      {tag && (
        <span style={{
          fontSize: 9, padding: '1px 5px', borderRadius: 3,
          background: 'rgba(86,156,214,0.1)', color: '#569cd6',
          fontFamily: 'var(--font-mono)', marginLeft: 'auto', flexShrink: 0,
        }}>
          {tag}
        </span>
      )}
      {badge !== undefined && badge > 0 && (
        <span style={{
          fontSize: 9, fontWeight: 700, minWidth: 16, height: 16,
          borderRadius: 8, background: 'var(--critical, #f04141)',
          color: '#fff', display: 'flex', alignItems: 'center',
          justifyContent: 'center', padding: '0 4px', flexShrink: 0,
        }}>
          {badge > 99 ? '99+' : badge}
        </span>
      )}
      {disabled && hovered && (
        <span style={{
          fontSize: 9, padding: '1px 5px', borderRadius: 3,
          background: NEW_BADGE_BG, color: NEW_BADGE_COLOR,
          fontFamily: 'var(--font-mono)', flexShrink: 0,
        }}>
          준비 중
        </span>
      )}
    </button>
  );
}

// ── 메인 사이드바 ─────────────────────────────────────────────────
export function AppSidebar() {
  const { t }                = useTranslation();
  const router               = useRouter();
  const user                 = useAuthStore((s) => s.user);
  const sidebarOpen          = useSecureStore((s) => s.sidebarOpen);
  const setSidebarOpen       = useSecureStore((s) => s.setSidebarOpen);
  const sidebarWidth         = useSecureStore((s) => s.sidebarWidth);
  const viewMode             = useSecureStore((s) => s.viewMode);
  const setViewMode          = useSecureStore((s) => s.setViewMode);
  const selectedPath         = useSecureStore((s) => s.selectedPath);
  const setSelectedPath      = useSecureStore((s) => s.setSelectedPath);
  const openTabs             = useSecureStore((s) => s.openTabs);
  const openTab              = useSecureStore((s) => s.openTab);
  const workspaceId          = useSecureStore((s) => s.workspaceId);
  const workspaceName        = useSecureStore((s) => s.workspaceName);
  const workspaceTree        = useSecureStore((s) => s.workspaceTree);
  const extraWorkspaces      = useSecureStore((s) => s.extraWorkspaces);
  const removeExtraWorkspace = useSecureStore((s) => s.removeExtraWorkspace);
  const setActiveWorkspaceId = useSecureStore((s) => s.setActiveWorkspaceId);
  const projectId            = useSecureStore((s) => s.projectId);
  const setProjectId         = useSecureStore((s) => s.setProjectId);
  const vulns                = useSecureStore((s) => s.vulns);

  const clearVulns = useSecureStore((s) => s.clearVulns);
  const addVuln    = useSecureStore((s) => s.addVuln);
  const addToast   = useToastStore((s) => s.addToast);

  const { openFolder, addFolder, status: wsStatus, progress: wsProgress } = useWorkspace();
  const { projects, loading: projectsLoading } = useProjects();

  const [showPickerMenu, setShowPickerMenu]       = useState(false);
  const [workspaceExpanded, setWorkspaceExpanded] = useState(true);
  const [primaryExpanded, setPrimaryExpanded]     = useState(true);
  const [extraExpanded, setExtraExpanded]         = useState<Record<string, boolean>>({});
  const [ctxMenu, setCtxMenu]                     = useState<CtxMenu | null>(null);
  const [showPdfModal, setShowPdfModal]           = useState(false);
  const [showSecurityDoc, setShowSecurityDoc]     = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    if (!showPickerMenu) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPickerMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPickerMenu]);

  const vulnCountMap: Record<string, number> = {};
  for (const v of vulns) {
    const rank = severityRank[v.severity] ?? 0;
    vulnCountMap[v.filePath] = Math.max(vulnCountMap[v.filePath] ?? 0, rank);
  }

  const hasLocalWorkspace = !!workspaceId && workspaceTree.length > 0;
  const busy = wsStatus === 'reading' || wsStatus === 'uploading';
  const localTree   = injectVulnCount(workspaceTree, vulnCountMap);
  const virtualTree = buildVirtualTree(vulns);
  const showVirtualTree = !hasLocalWorkspace && virtualTree.length > 0;

  const hasAnyExplorer = hasLocalWorkspace || extraWorkspaces.length > 0 || showVirtualTree;

  const handleSelectFile = (path: string, wsId?: string) => {
    if (wsId !== undefined) setActiveWorkspaceId(wsId);
    setSelectedPath(path);
    openTab(path, path.split('/').pop() ?? path);
    setViewMode('editor');
  };

  const handlePickOpen = () => { openFolder(); setShowPickerMenu(false); };
  const handlePickAdd  = () => { addFolder();  setShowPickerMenu(false); };

  const handleCtxMenu = useCallback((e: React.MouseEvent, p: ProjectSummary) => {
    e.preventDefault();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const menuW = 188;
    const menuH = 100;
    const x = Math.min(e.clientX, vw - menuW - 8);
    const y = Math.min(e.clientY, vh - menuH - 8);
    setCtxMenu({ project: p, x, y });
  }, []);

  const handleCtxActivate = useCallback((p: ProjectSummary) => {
    setProjectId(p.id);
    addToast(`"${p.name}"을(를) 활성 프로젝트로 설정했습니다.`, 'info');
  }, [setProjectId, addToast]);

  const handleCtxLoadLatest = useCallback(async (p: ProjectSummary) => {
    try {
      const sessRes = await apiClient.get<{ data: { content: Array<{ id: string; status: string }> } }>(
        `/analysis/sessions?projectId=${p.id}&size=20`,
      );
      const latest = (sessRes.data?.content ?? []).find((s) => s.status === 'completed');
      if (!latest) { addToast('완료된 분석 이력이 없습니다.', 'error'); return; }

      const vulnRes = await apiClient.get<{ data: { content: Array<{
        id: string; filePath: string; lineNumber: number | null; vulnType: string;
        severity: string; category: string | null; cwe: string | null;
        owasp: string | null; description: string | null;
      }> } }>(`/vulnerabilities?sessionId=${latest.id}&size=500`);

      clearVulns();
      for (const v of (vulnRes.data?.content ?? [])) {
        const rawSev = (v.severity ?? 'low').toLowerCase() as Severity;
        const severity: Severity = VALID_SEV.includes(rawSev) ? rawSev : 'low';
        const rawCat = (v.category ?? 'SECURITY') as VulnCategory;
        const category: VulnCategory = VALID_CAT.includes(rawCat) ? rawCat : 'SECURITY';
        addVuln({
          id: v.id, type: v.vulnType, severity, category,
          lineStart: v.lineNumber ?? 0, lineEnd: v.lineNumber ?? 0,
          filePath: v.filePath, description: v.description ?? '',
          cweId: v.cwe ?? '', owaspCategory: v.owasp ?? '', status: 'open',
          apiGroup: deriveApiGroup(v.filePath),
        } as Vulnerability);
      }
      setProjectId(p.id);
      addToast(`"${p.name}" 최신 분석 결과를 불러왔습니다.`, 'info');
    } catch {
      addToast('분석 결과 로드에 실패했습니다.', 'error');
    }
  }, [clearVulns, addVuln, setProjectId, addToast]);

  // ── 메뉴 아이템 공통 스타일 ─
  const menuItemStyle: React.CSSProperties = {
    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
    padding: '9px 12px', background: 'none', border: 'none',
    cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s',
  };

  // 슬림 레일: sidebarOpen=false 시 항상 표시
  if (!sidebarOpen) {
    return (
      <SlimRail
        vulnCount={vulns.length}
        openTabCount={openTabs.length}
        onExpand={() => setSidebarOpen(true)}
      />
    );
  }

  return (
    <motion.aside
      className="editor-sidebar"
      animate={{ width: sidebarWidth, opacity: 1 }}
      transition={{ type: 'tween', duration: 0.15 }}
      style={{
        background: '#0f0f0f',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden', flexShrink: 0,
      }}
      aria-label="워크스페이스 사이드바"
    >
      {/* ── Team Workspace ── */}
      <div style={{
        padding: '13px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
      }}>
        <Shield size={15} color="#f97316" aria-hidden="true" style={{ flexShrink: 0 }} />
        <span style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
          color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {user?.plan === 'team' ? `${user.username || 'TEAM'} WORKSPACE` : 'MY WORKSPACE'}
        </span>
      </div>

      {/* ── 폴더 버튼 (+ 드롭다운 메뉴) ── */}
      <div ref={pickerRef} style={{ padding: '8px 8px 6px', flexShrink: 0, position: 'relative' }}>
        <button
          onClick={hasLocalWorkspace ? () => setShowPickerMenu((v) => !v) : openFolder}
          disabled={busy}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 7,
            padding: '7px 10px', fontSize: 11, fontWeight: 600,
            background: hasLocalWorkspace ? 'rgba(249,115,22,0.08)' : 'rgba(249,115,22,0.15)',
            border: `1px solid ${hasLocalWorkspace ? 'rgba(249,115,22,0.2)' : 'rgba(249,115,22,0.35)'}`,
            borderRadius: 7, cursor: busy ? 'not-allowed' : 'pointer',
            color: hasLocalWorkspace ? 'rgba(249,115,22,0.7)' : '#f97316',
            opacity: busy ? 0.6 : 1, minWidth: 0,
          }}
        >
          {busy ? (
            <>
              <Loader2 size={12} style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {wsProgress}
              </span>
            </>
          ) : (
            <>
              <FolderOpen size={12} style={{ flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {hasLocalWorkspace ? (workspaceName ?? '폴더 열기') : '폴더 열기'}
              </span>
              {hasLocalWorkspace && (
                <ChevronDown size={10} style={{ flexShrink: 0, opacity: 0.5, transform: showPickerMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
              )}
            </>
          )}
        </button>

        {/* 드롭다운 — 워크스페이스가 있을 때 표시 */}
        {showPickerMenu && !busy && (
          <div style={{
            position: 'absolute', top: 'calc(100% - 2px)', left: 8, right: 8, zIndex: 50,
            background: '#1c1c1f', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 8, overflow: 'hidden',
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
          }}>
            {/* 프로젝트 열기 (대체) */}
            <button
              onClick={handlePickOpen}
              style={menuItemStyle}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                background: 'rgba(249,115,22,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <FolderOpen size={13} color="#f97316" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#e8e8ee' }}>프로젝트 열기</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>
                  현재 워크스페이스를 대체합니다
                </div>
              </div>
            </button>

            {/* 구분선 */}
            <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '0 8px' }} />

            {/* 워크스페이스에 추가 */}
            <button
              onClick={handlePickAdd}
              style={menuItemStyle}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                background: 'rgba(129,140,248,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <FolderCode size={13} color="#818cf8" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#e8e8ee' }}>워크스페이스에 추가</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>
                  기존 폴더와 나란히 열어 탐색합니다
                </div>
              </div>
            </button>

            {/* 구분선 */}
            <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '0 8px' }} />

            {/* 취소 */}
            <button
              onClick={() => setShowPickerMenu(false)}
              style={{ ...menuItemStyle, justifyContent: 'center', padding: '7px 12px' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
            >
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>취소</span>
            </button>
          </div>
        )}
      </div>

      {/* ── 스크롤 영역 (EXPLORER + WORKSPACE + Empty) ── */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>

        {/* ── EXPLORER: 모든 로컬 폴더를 하나의 공간에 ── */}
        {hasAnyExplorer && (
          <div style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: 4 }}>
            {/* 기본 워크스페이스 — 오렌지 FolderOpen */}
            {hasLocalWorkspace && (
              <WorkspaceRoot
                expanded={primaryExpanded}
                onToggle={() => setPrimaryExpanded((v) => !v)}
                icon={<FolderOpen size={10} color="#f97316" />}
                iconColor="#f97316"
                name={workspaceName ?? 'workspace'}
                tree={localTree}
                selectedPath={selectedPath}
                onSelect={(p) => handleSelectFile(p, workspaceId ?? undefined)}
              />
            )}

            {/* 취약점 기반 가상 트리 (로컬 폴더 없을 때) */}
            {showVirtualTree && (
              <WorkspaceRoot
                expanded={primaryExpanded}
                onToggle={() => setPrimaryExpanded((v) => !v)}
                icon={<FolderOpen size={10} color="rgba(255,255,255,0.3)" />}
                iconColor="rgba(255,255,255,0.35)"
                name="분석 파일"
                subtitle="가상 트리"
                tree={virtualTree}
                selectedPath={selectedPath}
                onSelect={(p) => handleSelectFile(p)}
              />
            )}

            {/* 추가 워크스페이스 — 인디고 FolderCode, × 닫기 */}
            {extraWorkspaces.map((ws) => {
              const isOpen = extraExpanded[ws.id] !== false;
              return (
                <WorkspaceRoot
                  key={ws.id}
                  expanded={isOpen}
                  onToggle={() => setExtraExpanded((prev) => ({ ...prev, [ws.id]: !isOpen }))}
                  icon={<FolderCode size={10} color="#818cf8" />}
                  iconColor="#818cf8"
                  name={ws.name}
                  tree={ws.tree}
                  selectedPath={selectedPath}
                  onSelect={(p) => handleSelectFile(p, ws.id)}
                  onClose={() => removeExtraWorkspace(ws.id)}
                />
              );
            })}
          </div>
        )}

        {/* ── WORKSPACE: API 프로젝트 목록 ── */}
        {!projectsLoading && projects.length > 0 && (
          <div>
            <button
              onClick={() => setWorkspaceExpanded((v) => !v)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '6px 12px 4px',
                background: 'none', border: 'none', cursor: 'pointer',
              }}
            >
              <span style={{
                fontSize: 9, color: 'rgba(255,255,255,0.2)',
                textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 700,
              }}>
                {t('sidebar.workspace', 'Workspace')}
              </span>
              {workspaceExpanded
                ? <ChevronDown size={11} color="rgba(255,255,255,0.2)" />
                : <ChevronRight size={11} color="rgba(255,255,255,0.2)" />}
            </button>

            {workspaceExpanded && (
              <div style={{ paddingBottom: 4 }}>
                {projects.map((p) => (
                  <ProjectRow
                    key={p.id}
                    project={p}
                    active={p.id === projectId}
                    onSelect={() => { if (p.id !== projectId) setProjectId(p.id); }}
                    onContextMenu={handleCtxMenu}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── 빈 상태 (아무것도 없을 때) ── */}
        {!hasLocalWorkspace && extraWorkspaces.length === 0 && projects.length === 0 && !projectsLoading && (
          <EmptyWorkspace onOpen={openFolder} status={wsStatus} progress={wsProgress} />
        )}
      </div>

      {/* ── 그룹 네비 ── */}
      <div style={{ flexShrink: 0, borderTop: '1px solid rgba(255,255,255,0.06)', overflowY: 'auto', maxHeight: '45vh' }}>

        {/* ── CORE 그룹 ── */}
        <NavGroupLabel label="CORE" color={GROUP_COLORS.core} />
        <NavItem
          icon={<Code2 size={13} />}
          label={t('header.editor', '코드 에디터')}
          active={viewMode === 'editor'}
          onClick={() => setViewMode('editor')}
        />
        <NavItem
          icon={<LayoutDashboard size={13} />}
          label={t('header.dashboard', '대시보드')}
          active={viewMode === 'dashboard'}
          onClick={() => setViewMode('dashboard')}
        />
        <NavItem
          icon={<ShieldAlert size={13} />}
          label="DAST 워크스페이스"
          active={viewMode === 'dast'}
          onClick={() => setViewMode('dast')}
          badge={0}
        />

        {/* ── SECURITY 그룹 ── */}
        <NavGroupLabel label="SECURITY" color={GROUP_COLORS.security} isNew />
        <NavItem
          icon={<Link2 size={13} />}
          label="시크릿 스캔 (커밋)"
          color={GROUP_COLORS.security}
          onClick={() => router.push('/commit-scan')}
        />
        <NavItem
          icon={<Github size={13} />}
          label="GitHub 스캔"
          color={GROUP_COLORS.security}
          onClick={() => router.push('/github-scan')}
        />
        <NavItem
          icon={<Package size={13} />}
          label="SBOM & CVE"
          color={GROUP_COLORS.security}
          onClick={() => {
            if (projectId) {
              router.push(`/projects/${projectId}/sbom`);
            } else {
              // projectId 없으면 에디터 내 SBOM 탭으로
              setViewMode('editor');
            }
          }}
        />
        <NavItem
          icon={<ClipboardList size={13} />}
          label="컴플라이언스"
          color={GROUP_COLORS.security}
          disabled={!projectId}
          disabledTooltip="프로젝트를 선택하면 활성화됩니다"
          onClick={() => {
            if (projectId) router.push(`/projects/${projectId}/compliance`);
          }}
        />
        {/* 관리자 항목 — admin 역할일 때만 노출 */}
        {user?.isAdmin && (
          <NavItem
            icon={<UserCog size={13} />}
            label="관리자"
            color={GROUP_COLORS.security}
            onClick={() => router.push('/admin/users')}
          />
        )}

        {/* ── AUTOMATION 그룹 ── */}
        <NavGroupLabel label="AUTOMATION" color={GROUP_COLORS.automation} isNew />
        <NavItem
          icon={<Github size={13} />}
          label="PR 자동 리뷰"
          color={GROUP_COLORS.automation}
          disabled
          disabledTooltip="준비 중 — 백엔드 API는 구현됨"
        />
        <NavItem
          icon={<Clock3 size={13} />}
          label="예약 자동 스캔"
          color={GROUP_COLORS.automation}
          disabled
          disabledTooltip="준비 중 — 백엔드 API는 구현됨"
        />
        <NavItem
          icon={<Activity size={13} />}
          label="도메인 모니터링"
          color={GROUP_COLORS.automation}
          disabled
          disabledTooltip="준비 중 — 백엔드 API는 구현됨"
        />

        {/* ── REPORTS 그룹 ── */}
        <NavGroupLabel label="REPORTS" color={GROUP_COLORS.reports} isNew />
        <NavItem
          icon={<FileText size={13} />}
          label="보고서 생성"
          color={GROUP_COLORS.reports}
          onClick={() => setShowPdfModal(true)}
        />
        <NavItem
          icon={<FileSearch size={13} />}
          label="규제 문서"
          color={GROUP_COLORS.reports}
          tag="CISO"
          onClick={() => setShowSecurityDoc(true)}
        />

        {/* ── 설정 / 기타 ── */}
        <NavGroupLabel label="SETTINGS" color={GROUP_COLORS.settings} />
        <NavItem
          icon={<Users size={13} />}
          label="팀 / 조직"
          onClick={() => router.push('/team')}
        />
        <NavItem
          icon={<Rocket size={13} />}
          label="온보딩"
          onClick={() => router.push('/onboarding')}
        />
        <NavItem
          icon={<Settings size={13} />}
          label="설정"
          onClick={() => router.push('/settings')}
        />
        <div style={{ height: 8 }} />
      </div>

      {/* ── 컨텍스트 메뉴 ── */}
      {ctxMenu && (
        <ProjectContextMenu
          menu={ctxMenu}
          onActivate={handleCtxActivate}
          onLoadLatest={handleCtxLoadLatest}
          onClose={() => setCtxMenu(null)}
        />
      )}

      {/* ── 모달: PDF 보고서 ── */}
      {showPdfModal && (
        <PdfReportModal onClose={() => setShowPdfModal(false)} />
      )}

      {/* ── 모달: 규제 문서 (SecurityDocPage — 오버레이 래퍼) ── */}
      {showSecurityDoc && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="규제 문서 생성"
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowSecurityDoc(false); }}
          onKeyDown={(e) => { if (e.key === 'Escape') setShowSecurityDoc(false); }}
        >
          <div style={{
            background: '#141414', borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.1)',
            width: 'min(760px, 92vw)', maxHeight: '88vh',
            overflowY: 'auto', position: 'relative',
            boxShadow: '0 24px 48px rgba(0,0,0,0.6)',
          }}>
            <div style={{
              position: 'sticky', top: 0, zIndex: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 20px',
              background: '#141414',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
            }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#e8e8ee' }}>규제 문서 생성</span>
              <button
                onClick={() => setShowSecurityDoc(false)}
                aria-label="닫기"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'rgba(255,255,255,0.4)', display: 'flex', padding: 4, borderRadius: 4,
                }}
              >
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: '16px 20px' }}>
              <SecurityDocPage />
            </div>
          </div>
        </div>
      )}
    </motion.aside>
  );
}
