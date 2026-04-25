// ============================================================
// Zustand 단일 스토어 — SecureAI
// ============================================================
import { create } from 'zustand';
import {
  mockVulnerabilities, mockChatMessages, mockDastLogs, mockPatches,
  type Vulnerability, type ChatMessage, type DastLog, type PatchSuggestion,
} from '@/lib/mockData';

export type Severity       = 'critical' | 'high' | 'medium' | 'low';
export type SeverityFilter = 'all' | Severity;
export type ViewMode       = 'editor' | 'dashboard';
export type RightTab       = 'vulns' | 'chat';

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

  // ── 패널 크기 (드래그 리사이즈) ──────────────────────────
  sidebarWidth:    number;
  setSidebarWidth: (w: number | ((prev: number) => number)) => void;
  rightPanelWidth:    number;
  setRightPanelWidth: (w: number | ((prev: number) => number)) => void;
  terminalHeight:     number;
  setTerminalHeight:  (h: number | ((prev: number) => number)) => void;

  // ── 취약점 ──────────────────────────────────────────────
  vulns: Vulnerability[];
  expandedVulnId: string | null;
  setExpandedVulnId: (id: string | null) => void;

  // ── 패치 ────────────────────────────────────────────────
  patches: PatchSuggestion[];
  applyPatch: (vulnId: string) => void;

  // ── 필터 ────────────────────────────────────────────────
  severityFilter:    SeverityFilter;
  setSeverityFilter: (f: SeverityFilter) => void;
  apiGroupFilter:    string | null;
  setApiGroupFilter: (g: string | null) => void;


  // ── 분석 상태 ───────────────────────────────────────────
  isAnalyzing: boolean;
  setIsAnalyzing: (v: boolean) => void;
  startAnalysis: () => void;

  // ── DAST 로그 ───────────────────────────────────────────
  dastLogs: DastLog[];

  // ── 채팅 ────────────────────────────────────────────────
  chatMessages: ChatMessage[];
  addChatMessage: (m: ChatMessage) => void;
  sendChat: (text: string) => void;
}

// ─── 스토어 구현 ─────────────────────────────────────────────
export const useSecureStore = create<SecureStore>((set, get) => ({
  // ── 뷰
  viewMode: 'editor',
  setViewMode: (m) => set((s) => ({ viewMode: typeof m === 'function' ? m(s.viewMode) : m })),

  rightTab: 'vulns',
  setRightTab: (t) => set({ rightTab: t }),

  sidebarOpen: true,
  setSidebarOpen: (v) => set((s) => ({ sidebarOpen: typeof v === 'function' ? v(s.sidebarOpen) : v })),

  // ── 파일
  selectedPath: '/src/main/java/UserAuth.java',
  setSelectedPath: (p) => set({ selectedPath: p }),

  // ── 패널 크기 (min/max 클램프 포함)
  sidebarWidth: 220,
  setSidebarWidth: (w) => set((s) => {
    const next = typeof w === 'function' ? w(s.sidebarWidth) : w;
    return { sidebarWidth: Math.max(160, Math.min(450, next)) };
  }),
  rightPanelWidth: 360,
  setRightPanelWidth: (w) => set((s) => {
    const next = typeof w === 'function' ? w(s.rightPanelWidth) : w;
    return { rightPanelWidth: Math.max(260, Math.min(600, next)) };
  }),
  terminalHeight: 180,
  setTerminalHeight: (h) => set((s) => {
    const next = typeof h === 'function' ? h(s.terminalHeight) : h;
    return { terminalHeight: Math.max(80, Math.min(500, next)) };
  }),

  // ── 취약점
  vulns: mockVulnerabilities,
  expandedVulnId: null,
  setExpandedVulnId: (id) =>
    set((s) => ({ expandedVulnId: s.expandedVulnId === id ? null : id })),

  // ── 패치
  patches: mockPatches,
  applyPatch: (vulnId) =>
    set((s) => ({
      vulns: s.vulns.map((v) =>
        v.id === vulnId ? { ...v, status: 'patched' as const } : v
      ),
    })),

  // ── 필터
  severityFilter: 'all',
  setSeverityFilter: (f) => set({ severityFilter: f }),
  apiGroupFilter: null,
  setApiGroupFilter: (g) => set({ apiGroupFilter: g }),


  // ── 분석
  isAnalyzing: false,
  setIsAnalyzing: (v) => set({ isAnalyzing: v }),
  startAnalysis: () => {
    set({ isAnalyzing: true });
    setTimeout(() => set({ isAnalyzing: false, viewMode: 'dashboard' }), 2800);
  },

  // ── DAST
  dastLogs: mockDastLogs,

  // ── 채팅
  chatMessages: mockChatMessages,
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
}));

export const useAppStore = useSecureStore;
