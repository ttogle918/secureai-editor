// ============================================================
//  SecureAI — 공통 TypeScript 타입 정의
// ============================================================

// ── Severity ─────────────────────────────────────────────
export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';

// ── Vulnerability ─────────────────────────────────────────
// NOTE: 이 인터페이스는 현재 미사용(어디서도 import되지 않음).
// 활성 취약점 타입은 `@/lib/mockData`의 Vulnerability + VulnStatus 를 사용한다.
// 필드 shape(title/line/cwe/owaspId)가 mockData 의 Vulnerability 와 달라
// 단순 병합 불가 — 향후 타입 통합 시 별도 리팩터링 필요.
export interface Vulnerability {
  id: string;
  severity: SeverityLevel;
  title: string;
  description: string;
  filePath: string;
  line: number;
  cwe: string;        // e.g. "CWE-89"
  owaspId: string;    // e.g. "A03:2021"
  apiGroup?: string;  // e.g. "/api/users"
  callChain?: CallChainNode[];
  diff?: DiffLine[];
  dastResult?: DastResult;
  status: 'open' | 'fixed' | 'false_positive' | 'ignored';
}

export interface CallChainNode {
  id: string;
  label: string;     // e.g. "LoginPage.tsx:18"
  isVulnerable: boolean;
  children?: CallChainNode[];
}

export interface DiffLine {
  type: 'add' | 'del' | 'same';
  content: string;
  lineNum?: number;
}

export interface DastResult {
  success: boolean;
  payload: string;
  description: string;
}

// ── FileTree ──────────────────────────────────────────────
export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  vulnerabilities?: SeverityLevel[];  // worst severity dots
}

// ── Analysis Session ──────────────────────────────────────
export type AnalysisStatus = 'idle' | 'running' | 'completed' | 'failed';

export interface AnalysisStep {
  id: string;
  label: string;
  done: boolean;
  inProgress: boolean;
}

// ── DAST Terminal ─────────────────────────────────────────
export type DastLogType = 'info' | 'ok' | 'warn' | 'error' | 'payload';

export interface DastLog {
  id: string;
  timestamp: string;
  type: DastLogType;
  message: string;
}

// ── Chat ──────────────────────────────────────────────────
export interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp?: string;
}

// ── Dashboard KPI ─────────────────────────────────────────
export interface KpiData {
  score: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  patchRate: number;  // 0-100 %
}

export interface TrendPoint {
  date: string;
  score: number;
}

export interface OwaspCell {
  id: string;       // "A01"
  name: string;     // "Access Control"
  status: 'hit' | 'partial' | 'none';
}

export interface FileHeatmapCell {
  file: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

// ── Store ──────────────────────────────────────────────────
export type ViewMode       = 'editor' | 'dashboard';
export type RightTab       = 'vulns' | 'chat';
export type SeverityFilter = 'all' | SeverityLevel;
export type ApiGroupFilter = string;  // '/api/users' | 'all' etc.
