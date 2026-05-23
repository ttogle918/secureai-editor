import fetch from 'node-fetch';

// Backend API 기본 URL — 환경변수 우선, 없으면 localhost 기본값 사용
const API_BASE_URL =
  process.env['SECUREAI_API_URL'] ?? 'http://localhost:8080/api/v1';

// 분석 결과 취약점 모델
export interface Vulnerability {
  filePath: string;
  line: number;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
  cweId?: string;
}

// 분석 세션 생성 응답 모델
interface AnalysisSessionResponse {
  id: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
}

// 취약점 목록 조회 응답 모델
interface VulnerabilityListResponse {
  items: Vulnerability[];
}

// 폴링 설정 상수
const POLL_INTERVAL_MS = 2_000;
const POLL_TIMEOUT_MS = 30_000;
const COMPLETED_STATUS = 'COMPLETED';
const FAILED_STATUS = 'FAILED';

/**
 * 분석 세션을 생성하고 세션 ID를 반환한다.
 * SRP: 세션 생성 요청만 담당한다.
 */
async function createAnalysisSession(
  workspacePath: string,
  token: string
): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/analysis/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // 토큰은 Authorization 헤더에만 사용하며 절대 로그에 출력하지 않는다
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ workspacePath }),
  });

  if (!response.ok) {
    throw new Error(`분석 세션 생성 실패: HTTP ${response.status}`);
  }

  const session = (await response.json()) as AnalysisSessionResponse;
  return session.id;
}

/**
 * 분석 세션 상태를 조회한다.
 * SRP: 상태 조회 요청만 담당한다.
 */
async function fetchSessionStatus(
  sessionId: string,
  token: string
): Promise<AnalysisSessionResponse> {
  const response = await fetch(
    `${API_BASE_URL}/analysis/sessions/${sessionId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`세션 상태 조회 실패: HTTP ${response.status}`);
  }

  return (await response.json()) as AnalysisSessionResponse;
}

/**
 * 분석이 완료될 때까지 폴링한다.
 * 최대 POLL_TIMEOUT_MS 동안 대기하며, 초과 시 오류를 던진다.
 * SRP: 폴링 로직만 담당한다.
 */
async function waitForCompletion(
  sessionId: string,
  token: string
): Promise<void> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const session = await fetchSessionStatus(sessionId, token);

    if (session.status === COMPLETED_STATUS) {
      return;
    }

    if (session.status === FAILED_STATUS) {
      throw new Error('분석이 실패 상태로 종료되었습니다.');
    }

    // 다음 폴링까지 대기
    await new Promise<void>((resolve) =>
      setTimeout(resolve, POLL_INTERVAL_MS)
    );
  }

  throw new Error('분석 시간 초과 (30초)');
}

/**
 * 분석 결과 취약점 목록을 조회한다.
 * SRP: 결과 조회만 담당한다.
 */
async function fetchVulnerabilities(
  sessionId: string,
  token: string
): Promise<Vulnerability[]> {
  const response = await fetch(
    `${API_BASE_URL}/analysis/sessions/${sessionId}/vulnerabilities`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`취약점 조회 실패: HTTP ${response.status}`);
  }

  const data = (await response.json()) as VulnerabilityListResponse;
  return data.items;
}

/**
 * 워크스페이스 경로를 분석하고 취약점 목록을 반환한다.
 *
 * 순서:
 * 1. 분석 세션 생성 (POST /analysis/sessions)
 * 2. 완료까지 폴링 (최대 30초)
 * 3. 취약점 목록 조회 (GET /analysis/sessions/{id}/vulnerabilities)
 *
 * @param workspacePath - 분석할 워크스페이스 절대 경로
 * @param token         - JWT 토큰 (SecretStorage에서 전달받음, 로그 출력 금지)
 */
export async function analyzeWorkspace(
  workspacePath: string,
  token: string
): Promise<Vulnerability[]> {
  const sessionId = await createAnalysisSession(workspacePath, token);
  await waitForCompletion(sessionId, token);
  return fetchVulnerabilities(sessionId, token);
}
