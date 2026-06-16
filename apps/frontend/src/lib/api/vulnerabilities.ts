/**
 * 취약점 API 클라이언트 함수
 * STAGE-1: stage 완료 시 파일 단위 점진 조회
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
