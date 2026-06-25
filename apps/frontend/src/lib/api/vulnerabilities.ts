/**
 * 취약점 API 클라이언트 함수
 * STAGE-1: stage 완료 시 파일 단위 점진 조회
 * BULK-TRIAGE: 다건 취약점 일괄 트리아지
 */
import { apiClient } from './client';

export interface VulnItem {
  id: string;
  sessionId: string;
  projectId: string;
  filePath: string;
  lineNumber: number | null;
  vulnType: string;
  severity: string;
  category: string;
  cwe: string | null;
  owasp: string | null;
  description: string | null;
  codeSnippet: string | null;
  callChain: string | null;
  fingerprint: string;
  status: string;
  createdAt: string;
}

interface PagedResponse<T> {
  data: {
    content: T[];
    totalElements: number;
    totalPages: number;
    size: number;
    number: number;
  };
}

const MAX_PAGE_SIZE = 200;

// ── 벌크 트리아지 ────────────────────────────────────────────────────────────

export type BulkTriageAction = 'CONFIRM' | 'DISMISS' | 'ACCEPT_PATCH';

export interface BulkTriageRequest {
  vulnIds: string[];
  action: BulkTriageAction;
  /** DISMISS 액션 시 기각 사유 (최대 1000자) */
  reason?: string;
}

export interface BulkTriageResult {
  requested: number;
  applied: number;
  skipped: number;
  newStatus: string;
  appliedVulnIds: string[];
}

interface ApiResponse<T> {
  data: T;
}

/**
 * PATCH /api/v1/vulnerabilities/bulk-triage
 * 다건 취약점을 일괄 트리아지한다.
 * 응답 data.appliedVulnIds에 없는 id는 skip(권한 없음/미존재) 처리됨.
 */
export async function bulkTriageVulns(
  req: BulkTriageRequest,
): Promise<BulkTriageResult> {
  const response = await apiClient.patch<ApiResponse<BulkTriageResult>>(
    '/vulnerabilities/bulk-triage',
    req,
  );
  return response.data;
}

/**
 * POST /api/v1/vulnerabilities/query
 * stage 완료 시 해당 stage의 파일 경로 목록으로 취약점을 조회한다.
 * stage 단위 호출만 허용 — 전체 일괄 호출 금지.
 */
export async function fetchVulnerabilitiesByFiles(
  sessionId: string,
  filePaths: string[],
  page = 0,
  size = MAX_PAGE_SIZE,
): Promise<VulnItem[]> {
  const response = await apiClient.post<PagedResponse<VulnItem>>(
    '/vulnerabilities/query',
    { sessionId, filePaths, page, size },
  );
  return response.data.content;
}
