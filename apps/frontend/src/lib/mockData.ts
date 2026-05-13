// ============================================================
// SecureAI — Domain Types
// Mock 상수는 제거됨. 실제 데이터는 API / Zustand store에서 관리.
// ============================================================

export type Severity   = 'critical' | 'high' | 'medium' | 'low';
export type VulnStatus = 'open' | 'exploited' | 'patched' | 'pending';

export interface CallChainStep {
  layer: 'Frontend' | 'Controller' | 'Service' | 'Repository' | 'Config';
  label: string;
  file: string;
  filePath: string;
  line: number;
  codeSnippet?: string;
  isVulnerable: boolean;
}

export type VulnCategory = 'SECURITY' | 'CODE_QUALITY';

export interface Vulnerability {
  id: string;
  type: string;
  severity: Severity;
  category?: VulnCategory;
  lineStart: number;
  lineEnd: number;
  filePath: string;
  description: string;
  cweId: string;
  owaspCategory: string;
  status: VulnStatus;
  dastResult?: string;
  apiEndpoint?: string;
  apiGroup?: string;
  callChain?: CallChainStep[];
}

export interface PatchSuggestion {
  vulnId?: string;
  filePath: string;
  vulnType: string;
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
