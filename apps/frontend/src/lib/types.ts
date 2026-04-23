// ============================================================
// types.ts — 공통 타입 분리
// ============================================================

export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type VulnStatus = 'open' | 'exploited' | 'patched' | 'pending';

export interface CallChainStep {
  layer: 'Frontend' | 'Controller' | 'Service' | 'DAO' | 'Repository' | 'Config';
  label: string;       // 함수명
  file: string;        // 파일 경로
  line: number;
  codeSnippet?: string;
  isVulnerable: boolean;
}

export interface Vulnerability {
  id: string;
  type: string;
  severity: Severity;
  lineStart: number;
  lineEnd: number;
  filePath: string;
  description: string;
  cweId: string;
  owaspCategory: string;
  status: VulnStatus;
  dastResult?: string;
  apiEndpoint?: string;   // e.g. "POST /api/users/login"
  apiGroup?: string;      // e.g. "/api/users"  (필터용 prefix)
  callChain?: CallChainStep[];
}

export interface PatchSuggestion {
  vulnId: string;
  originalCode: string;
  patchedCode: string;
  explanation: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: string;
}

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  language?: string;
  vulnCount?: number;
  expanded?: boolean;
  children?: FileNode[];
}

export interface DastLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
}

export interface GithubPR {
  id: number;
  number: number;
  title: string;
  branch: string;
  status: 'pass' | 'fail' | 'warning' | 'running';
  vulnCount: number;
  detail: string;
  time: string;
}

export interface DashboardStats {
  totalVulns: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  patched: number;
  securityScore: number;
  trend: { date: string; critical: number; high: number; medium: number }[];
}

// 필터 상태
export interface FilterState {
  severities: Severity[];          // 선택된 심각도 (빈 배열 = 전체)
  apiGroup: string | null;         // 선택된 API 그룹 prefix
}
