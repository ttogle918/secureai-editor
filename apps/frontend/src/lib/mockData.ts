// ============================================================
// Kkebi — Domain Types
// Mock 상수는 제거됨. 실제 데이터는 API / Zustand store에서 관리.
// ============================================================

export type Severity   = 'critical' | 'high' | 'medium' | 'low';
/**
 * 서버 영속 취약점 상태 — 백엔드 Vulnerability.java Status enum 과 1:1 대응.
 * DAST exploit 성공 여부는 status 와 무관하며 dastExploitResults store 에서 별도 관리.
 * (이전 값 'exploited'|'patched'|'pending' 은 mock 잔재로 제거됨)
 */
export type VulnStatus = 'open' | 'false_positive' | 'fixed';

/**
 * 서버에서 받은 임의 문자열을 VulnStatus 로 정규화한다.
 * 알 수 없는 값 또는 null/undefined 는 'open' 으로 폴백한다.
 */
export function normalizeVulnStatus(raw: string | null | undefined): VulnStatus {
  if (raw === 'false_positive' || raw === 'fixed') return raw;
  return 'open';
}

/**
 * 취약점이 해결된 상태(패치 적용 완료)인지 판정한다.
 * 매직 스트링 'fixed' 를 컴포넌트에 분산 기재하는 대신 이 헬퍼를 사용한다.
 */
export function isVulnResolved(status: VulnStatus): boolean {
  return status === 'fixed';
}

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
