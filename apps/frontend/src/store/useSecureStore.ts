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
export type RightTab       = 'vulns' | 'chat' | 'progress' | 'sbom';
export type DisplayLanguage = 'ko' | 'en';
export type PreferencesLanguage = 'ko' | 'en' | 'ja' | 'zh' | 'es' | 'de';
export type PreferencesTheme = 'dark' | 'dim' | 'light';
export type AiTone = 'direct' | 'friendly' | 'expert' | 'teaching';
export type WorkspaceMode = 'DEVELOPER' | 'SECURITY_MANAGER';

export interface DastExploitResult {
  success: boolean;
  evidence: string;
  payload: string;
  responseSnippet: string;
  error: string | null;
  logMessages: string[];
}

// 프로젝트 요약 — useProjects 훅과 공유 (순환 의존성 방지를 위해 인라인 정의)
export interface WorkspaceProject {
  id: string;
  name: string;
  lastAnalyzedAt: string | null;
  vulnCount: number;
}

// 진행률 단계 타입 — ProgressPanel과 순환 의존성 방지를 위해 인라인 정의
export interface ProgressStep {
  stepName: string;
  stepOrder: number;
  target: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  durationMs?: number;
}

// API 중심 분석 (TASK-1106) — api_discovery_node 결과
export type FileAnalysisStatus = 'pending' | 'analyzing' | 'done' | 'cached' | 'failed';

export interface ApiGroupFile {
  path: string;
  line: number;
}

export interface ApiGroup {
  name: string;
  url: string;
  files: ApiGroupFile[];
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

  // ── 추가 워크스페이스 (다중 폴더) ──────────────────────
  extraWorkspaces: Array<{ id: string; name: string; tree: FileNode[] }>;
  addExtraWorkspace: (ws: { id: string; name: string; tree: FileNode[] }) => void;
  removeExtraWorkspace: (id: string) => void;
  activeWorkspaceId: string | null;
  setActiveWorkspaceId: (id: string | null) => void;

  // ── 프로젝트 목록 (전역 캐시 — useProjects 훅이 설정) ────
  workspaceProjects: WorkspaceProject[];
  setWorkspaceProjects: (projects: WorkspaceProject[]) => void;

  // ── 프로젝트 ─────────────────────────────────────────────
  projectId: string | null;
  /** 일반 프로젝트 전환. lockedSessionId를 초기화하여 자동 재로드를 허용한다. */
  setProjectId: (id: string | null) => void;
  /**
   * 분석 이력 모달에서 다른 프로젝트의 특정 세션을 불러올 때 사용.
   * lockedSessionId를 설정하여 useLoadLatestResults 자동 재로드를 억제한다.
   */
  switchProjectFromHistory: (projectId: string, sessionId: string) => void;

  // ── 이력 세션 잠금 (자동 재로드 충돌 방지) ───────────────
  lockedSessionId: string | null;
  clearLockedSession: () => void;

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

  // ── DAST ────────────────────────────────────────────────
  dastLogs: DastLog[];
  dastSessionId: string | null;
  dastBaseUrl: string;
  dastExploitResults: Record<string, DastExploitResult>;
  setDastSessionId: (id: string | null) => void;
  setDastBaseUrl: (url: string) => void;
  clearDastLogs: () => void;
  addDastLog: (log: DastLog) => void;
  setDastExploitResult: (vulnId: string, result: DastExploitResult) => void;

  // ── 진행률 ──────────────────────────────────────────────
  progressSteps: ProgressStep[];
  setProgressSteps: (steps: ProgressStep[]) => void;
  addProgressStep: (step: ProgressStep) => void;
  updateProgressStep: (stepOrder: number, update: Partial<ProgressStep>) => void;
  clearProgressSteps: () => void;

  // ── API 중심 분석 (TASK-1106) ──────────────────────────────
  apiGroups: ApiGroup[];
  fileStatuses: Record<string, FileAnalysisStatus>;
  setApiGroups: (groups: ApiGroup[]) => void;
  setFileStatus: (path: string, status: FileAnalysisStatus) => void;
  clearApiAnalysis: () => void;

  // ── 언어 설정 ────────────────────────────────────────────
  displayLanguage: DisplayLanguage;
  setDisplayLanguage: (lang: DisplayLanguage) => void;

  // ── 초기 설정 페이지 — 언어/테마 ─────────────────────────
  language: PreferencesLanguage;
  setLanguage: (lang: PreferencesLanguage) => void;
  theme: PreferencesTheme;
  setTheme: (theme: PreferencesTheme) => void;

  // ── AI 톤 설정 ───────────────────────────────────────────
  aiTone: AiTone;
  setAiTone: (tone: AiTone) => void;

  // ── 워크스페이스 모드 ────────────────────────────────────
  workspaceMode: WorkspaceMode;
  setWorkspaceMode: (m: WorkspaceMode) => void;

  // ── 채팅 도크 모드 ───────────────────────────────────────
  chatDockMode: boolean;
  setChatDockMode: (v: boolean) => void;

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

  // ── 추가 워크스페이스 (런타임만 — localStorage 미저장)
  extraWorkspaces: [],
  addExtraWorkspace: (ws) => set((s) => ({ extraWorkspaces: [...s.extraWorkspaces, ws] })),
  removeExtraWorkspace: (id) => set((s) => ({ extraWorkspaces: s.extraWorkspaces.filter((w) => w.id !== id) })),
  activeWorkspaceId: null,
  setActiveWorkspaceId: (id) => set({ activeWorkspaceId: id }),

  // ── 프로젝트 목록 캐시
  workspaceProjects: [],
  setWorkspaceProjects: (projects) => set({ workspaceProjects: projects }),

  // ── 프로젝트
  projectId: null,
  setProjectId: (id) => set({ projectId: id, lockedSessionId: null }),
  switchProjectFromHistory: (projectId, sessionId) =>
    set({ projectId, lockedSessionId: sessionId }),

  // ── 이력 세션 잠금
  lockedSessionId: null,
  clearLockedSession: () => set({ lockedSessionId: null }),

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
  dastSessionId: null,
  dastBaseUrl: '',
  dastExploitResults: {},
  setDastSessionId: (id) => set({ dastSessionId: id }),
  setDastBaseUrl: (url) => set({ dastBaseUrl: url }),
  clearDastLogs: () => set({ dastLogs: [] }),
  addDastLog: (log) => set((s) => ({ dastLogs: [...s.dastLogs, log] })),
  setDastExploitResult: (vulnId, result) =>
    set((s) => ({ dastExploitResults: { ...s.dastExploitResults, [vulnId]: result } })),

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

  // ── API 중심 분석 (TASK-1106)
  apiGroups: [],
  fileStatuses: {},
  setApiGroups: (groups) => set(() => {
    // 그룹의 모든 파일을 pending으로 초기화
    const statuses: Record<string, FileAnalysisStatus> = {};
    for (const g of groups) for (const f of g.files) statuses[f.path] = 'pending';
    return { apiGroups: groups, fileStatuses: statuses };
  }),
  setFileStatus: (path, status) => set((s) => ({
    fileStatuses: { ...s.fileStatuses, [path]: status },
  })),
  clearApiAnalysis: () => set({ apiGroups: [], fileStatuses: {} }),

  // ── 언어
  displayLanguage: 'ko',
  setDisplayLanguage: (lang) => set({ displayLanguage: lang }),

  // ── 초기 설정 — 언어/테마
  language: 'ko',
  setLanguage: (lang) => set({ language: lang }),
  theme: 'dark',
  setTheme: (theme) => set({ theme }),

  // ── AI 톤
  aiTone: 'direct',
  setAiTone: (tone) => set({ aiTone: tone }),

  // ── 워크스페이스 모드
  workspaceMode: 'DEVELOPER',
  setWorkspaceMode: (m) => set({ workspaceMode: m }),

  // ── 채팅 도크 모드
  chatDockMode: false,
  setChatDockMode: (v) => set({ chatDockMode: v }),

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
        language:        state.language,
        theme:           state.theme,
        dastBaseUrl:     state.dastBaseUrl,
        aiTone:          state.aiTone,
        workspaceMode:   state.workspaceMode,
      }),
    }
  )
);

export const useAppStore = useSecureStore;
