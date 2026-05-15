// ============================================================
// Zustand 단일 스토어 — SecureAI
// ============================================================
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  type Vulnerability, type ChatMessage, type DastLog, type PatchSuggestion, type FileNode,
} from '@/lib/mockData';
import type { SeverityLevel } from '@/types';

export type Severity       = 'critical' | 'high' | 'medium' | 'low';
export type SeverityFilter = 'all' | Severity;
export type ViewMode       = 'editor' | 'dashboard';
export type RightTab       = 'vulns' | 'chat' | 'progress';
export type DisplayLanguage = 'ko' | 'en';

// 진행률 단계 타입 — ProgressPanel과 순환 의존성 방지를 위해 인라인 정의
export interface ProgressStep {
  stepName: string;
  stepOrder: number;
  target: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  durationMs?: number;
}

// 탭 타입 — EditorTabs.tsx와 동일 구조, circular 방지를 위해 인라인 정의
export interface EditorTab {
  path: string;
  label: string;
  severity?: SeverityLevel;
}

const INITIAL_TABS: EditorTab[] = [];
const DEFAULT_SELECTED_PATH = '';

// ─── 스토어 인터페이스 ────────────────────────────────────────
interface SecureStore {
  // ── 뷰 상태 ──────────────────────────────────────────────
  viewMode: ViewMode;
  setViewMode: (m: ViewMode | ((prev: ViewMode) => ViewMode)) => void;

  rightTab: RightTab;
  setRightTab: (t: RightTab) => void;

  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean | ((prev: boolean) => boolean)) => void;

  // ── 파일 선택 ────────────────────────────────────────────
  selectedPath: string;
  setSelectedPath: (p: string) => void;

  // ── 열린 탭 ──────────────────────────────────────────────
  openTabs: EditorTab[];
  openTab: (path: string, label: string, severity?: SeverityLevel) => void;
  closeTab: (path: string) => void;

  // ── 패널 크기 (드래그 리사이즈) ──────────────────────────
  sidebarWidth:    number;
  setSidebarWidth: (w: number | ((prev: number) => number)) => void;
  rightPanelWidth:    number;
  setRightPanelWidth: (w: number | ((prev: number) => number)) => void;
  terminalHeight:     number;
  setTerminalHeight:  (h: number | ((prev: number) => number)) => void;

  // ── 워크스페이스 (로컬 폴더) ────────────────────────────
  workspaceId: string | null;
  setWorkspaceId: (id: string | null) => void;
  workspaceName: string | null;
  setWorkspaceName: (name: string | null) => void;
  workspaceTree: FileNode[];
  setWorkspaceTree: (tree: FileNode[]) => void;

  // ── 프로젝트 ─────────────────────────────────────────────
  projectId: string | null;
  setProjectId: (id: string | null) => void;

  // ── 취약점 ──────────────────────────────────────────────
  vulns: Vulnerability[];
  addVuln: (v: Vulnerability) => void;
  clearVulns: () => void;
  expandedVulnId: string | null;
  setExpandedVulnId: (id: string | null) => void;
  revealLine: number | null;
  setRevealLine: (line: number | null) => void;

  // ── SSE 세션 ─────────────────────────────────────────────
  sseSessionId: string | null;
  setSseSessionId: (id: string | null) => void;

  // ── 토큰 사용량 ──────────────────────────────────────────
  lastTokenUsage: {
    inputTokens: number;
    outputTokens: number;
    cacheWriteTokens: number;
    cacheReadTokens: number;
    estimatedCostUsd: number;
    modelId: string;
  } | null;
  setLastTokenUsage: (usage: NonNullable<SecureStore['lastTokenUsage']> | null) => void;

  // ── 파일 내용 (에디터 + 패치 적용용) ────────────────────
  fileContents: Record<string, string>;
  setFileContent: (path: string, content: string) => void;

  // ── 패치 ────────────────────────────────────────────────
  patches: PatchSuggestion[];
  setPatches: (patches: PatchSuggestion[]) => void;
  applyPatch: (vulnId: string) => void;

  // ── 필터 ────────────────────────────────────────────────
  severityFilter:    SeverityFilter;
  setSeverityFilter: (f: SeverityFilter) => void;
  apiGroupFilter:    string | null;
  setApiGroupFilter: (g: string | null) => void;


  // ── 분석 상태 ───────────────────────────────────────────
  isAnalyzing: boolean;
  setIsAnalyzing: (v: boolean) => void;

  // ── DAST 로그 ───────────────────────────────────────────
  dastLogs: DastLog[];

  // ── 진행률 ──────────────────────────────────────────────
  progressSteps: ProgressStep[];
  setProgressSteps: (steps: ProgressStep[]) => void;
  addProgressStep: (step: ProgressStep) => void;
  updateProgressStep: (stepOrder: number, update: Partial<ProgressStep>) => void;
  clearProgressSteps: () => void;

  // ── 언어 설정 ────────────────────────────────────────────
  displayLanguage: DisplayLanguage;
  setDisplayLanguage: (lang: DisplayLanguage) => void;

  // ── 채팅 ────────────────────────────────────────────────
  chatMessages: ChatMessage[];
  addChatMessage: (m: ChatMessage) => void;
  sendChat: (text: string) => void;
}

// ─── 스토어 구현 ─────────────────────────────────────────────
export const useSecureStore = create<SecureStore>()(
  persist(
    (set, get) => ({
  // ── 뷰
  viewMode: 'editor',
  setViewMode: (m) => set((s) => ({ viewMode: typeof m === 'function' ? m(s.viewMode) : m })),

  rightTab: 'vulns',
  setRightTab: (t) => set({ rightTab: t }),

  sidebarOpen: true,
  setSidebarOpen: (v) => set((s) => ({ sidebarOpen: typeof v === 'function' ? v(s.sidebarOpen) : v })),

  // ── 파일
  selectedPath: DEFAULT_SELECTED_PATH,
  setSelectedPath: (p) => set({ selectedPath: p }),

  // ── 열린 탭
  openTabs: INITIAL_TABS,
  openTab: (path, label, severity) => set((s) => {
    const alreadyOpen = s.openTabs.some((t) => t.path === path);
    if (alreadyOpen) {
      return { selectedPath: path };
    }
    return {
      openTabs: [...s.openTabs, { path, label, severity }],
      selectedPath: path,
    };
  }),
  closeTab: (path) => set((s) => {
    const filtered = s.openTabs.filter((t) => t.path !== path);
    if (s.selectedPath !== path) {
      return { openTabs: filtered };
    }
    if (filtered.length === 0) {
      return { openTabs: filtered, selectedPath: DEFAULT_SELECTED_PATH };
    }
    const closedIdx = s.openTabs.findIndex((t) => t.path === path);
    const nextTab = filtered[closedIdx - 1] ?? filtered[0];
    return { openTabs: filtered, selectedPath: nextTab.path };
  }),

  // ── 패널 크기 (min/max 클램프 포함)
  sidebarWidth: 220,
  setSidebarWidth: (w) => set((s) => {
    const next = typeof w === 'function' ? w(s.sidebarWidth) : w;
    return { sidebarWidth: Math.max(160, Math.min(400, next)) };
  }),
  rightPanelWidth: 360,
  setRightPanelWidth: (w) => set((s) => {
    const next = typeof w === 'function' ? w(s.rightPanelWidth) : w;
    return { rightPanelWidth: Math.max(280, Math.min(640, next)) };
  }),
  terminalHeight: 180,
  setTerminalHeight: (h) => set((s) => {
    const next = typeof h === 'function' ? h(s.terminalHeight) : h;
    return { terminalHeight: Math.max(80, Math.min(500, next)) };
  }),

  // ── 워크스페이스
  workspaceId: null,
  setWorkspaceId: (id) => set({ workspaceId: id }),
  workspaceName: null,
  setWorkspaceName: (name) => set({ workspaceName: name }),
  workspaceTree: [],
  setWorkspaceTree: (tree) => set({ workspaceTree: tree }),

  // ── 프로젝트
  projectId: null,
  setProjectId: (id) => set({ projectId: id }),

  // ── 취약점
  vulns: [],
  addVuln: (v) => set((s) => ({ vulns: [...s.vulns, v] })),
  clearVulns: () => set({ vulns: [] }),
  expandedVulnId: null,
  setExpandedVulnId: (id) =>
    set((s) => ({ expandedVulnId: s.expandedVulnId === id ? null : id })),
  revealLine: null,
  setRevealLine: (line) => set({ revealLine: line }),

  // ── SSE 세션
  sseSessionId: null,
  setSseSessionId: (id) => set({ sseSessionId: id }),

  // ── 토큰 사용량
  lastTokenUsage: null,
  setLastTokenUsage: (usage) => set({ lastTokenUsage: usage }),

  // ── 파일 내용
  fileContents: {},
  setFileContent: (path, content) =>
    set((s) => ({ fileContents: { ...s.fileContents, [path]: content } })),

  // ── 패치
  patches: [],
  setPatches: (patches) => set({ patches }),
  applyPatch: (vulnId) =>
    set((s) => {
      const vuln  = s.vulns.find((v) => v.id === vulnId);
      const patch = s.patches.find((p) =>
        (p.vulnId && p.vulnId === vulnId) ||
        (vuln && p.filePath === vuln.filePath && p.vulnType === vuln.type)
      );

      const newContents = { ...s.fileContents };
      if (patch && patch.originalCode && newContents[patch.filePath] !== undefined) {
        newContents[patch.filePath] = newContents[patch.filePath].replace(
          patch.originalCode,
          patch.patchedCode,
        );
      }

      return {
        fileContents: newContents,
        vulns: s.vulns.map((v) =>
          v.id === vulnId ? { ...v, status: 'patched' as const } : v
        ),
      };
    }),

  // ── 필터
  severityFilter: 'all',
  setSeverityFilter: (f) => set({ severityFilter: f }),
  apiGroupFilter: null,
  setApiGroupFilter: (g) => set({ apiGroupFilter: g }),


  // ── 분석
  isAnalyzing: false,
  setIsAnalyzing: (v) => set({ isAnalyzing: v }),

  // ── DAST
  dastLogs: [],

  // ── 진행률
  progressSteps: [],
  setProgressSteps: (steps) => set({ progressSteps: steps }),
  addProgressStep: (step) => set((s) => {
    const exists = s.progressSteps.some((p) => p.stepOrder === step.stepOrder);
    if (exists) {
      return { progressSteps: s.progressSteps.map((p) => p.stepOrder === step.stepOrder ? { ...p, ...step } : p) };
    }
    return { progressSteps: [...s.progressSteps, step] };
  }),
  updateProgressStep: (stepOrder, update) =>
    set((s) => ({
      progressSteps: s.progressSteps.map((step) =>
        step.stepOrder === stepOrder ? { ...step, ...update } : step
      ),
    })),
  clearProgressSteps: () => set({ progressSteps: [] }),

  // ── 언어
  displayLanguage: 'ko',
  setDisplayLanguage: (lang) => set({ displayLanguage: lang }),

  // ── 채팅
  chatMessages: [],
  addChatMessage: (m) => set((s) => ({ chatMessages: [...s.chatMessages, m] })),
  sendChat: (text) => {
    const userMsg: ChatMessage = {
      id: Date.now().toString(), role: 'user', content: text,
      timestamp: new Date().toLocaleTimeString('ko-KR'),
    };
    set((s) => ({ chatMessages: [...s.chatMessages, userMsg] }));
    setTimeout(() => {
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(), role: 'ai',
        content: `"${text}" — 현재 ${get().vulns.length}개 취약점이 감지됩니다. 상세 분석이 필요하신가요?`,
        timestamp: new Date().toLocaleTimeString('ko-KR'),
      };
      set((s) => ({ chatMessages: [...s.chatMessages, aiMsg] }));
    }, 800);
  },
    }),
    {
      name: 'secureai-editor-state',
      partialize: (state) => ({
        sidebarWidth:    state.sidebarWidth,
        rightPanelWidth: state.rightPanelWidth,
        terminalHeight:  state.terminalHeight,
        workspaceId:     state.workspaceId,
        workspaceName:   state.workspaceName,
        workspaceTree:   state.workspaceTree,
        openTabs:        state.openTabs,
        selectedPath:    state.selectedPath,
        projectId:       state.projectId,
        lastTokenUsage:  state.lastTokenUsage,
        displayLanguage: state.displayLanguage,
      }),
    }
  )
);

export const useAppStore = useSecureStore;
