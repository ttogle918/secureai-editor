/**
 * bulkTriageVulns — 벌크 트리아지 API 함수 단위 테스트
 */
import { bulkTriageVulns } from '../vulnerabilities';
import { setAccessToken, BASE_URL } from '../client';

// ── fetch mock 헬퍼 ─────────────────────────────────────────────────────────
function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: `status ${status}`,
    json: async () => body,
  } as unknown as Response;
}

const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
  setAccessToken(null);
});

describe('bulkTriageVulns', () => {
  it('PATCH /vulnerabilities/bulk-triage를 올바른 body로 호출한다', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        data: {
          requested: 3,
          applied: 3,
          skipped: 0,
          newStatus: 'false_positive',
          appliedVulnIds: ['v1', 'v2', 'v3'],
        },
      }),
    );

    const result = await bulkTriageVulns({
      vulnIds: ['v1', 'v2', 'v3'],
      action: 'DISMISS',
      reason: '오탐으로 판단',
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/vulnerabilities/bulk-triage`);
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toMatchObject({
      vulnIds: ['v1', 'v2', 'v3'],
      action: 'DISMISS',
      reason: '오탐으로 판단',
    });
    expect(result.applied).toBe(3);
    expect(result.skipped).toBe(0);
    expect(result.appliedVulnIds).toEqual(['v1', 'v2', 'v3']);
  });

  it('reason을 생략하면 body에 포함하지 않는다', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        data: {
          requested: 1,
          applied: 1,
          skipped: 0,
          newStatus: 'open',
          appliedVulnIds: ['v1'],
        },
      }),
    );

    await bulkTriageVulns({ vulnIds: ['v1'], action: 'CONFIRM' });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.reason).toBeUndefined();
  });

  it('일부 skip 시 appliedVulnIds가 요청보다 적게 반환된다', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        data: {
          requested: 3,
          applied: 2,
          skipped: 1,
          newStatus: 'fixed',
          appliedVulnIds: ['v1', 'v2'],
        },
      }),
    );

    const result = await bulkTriageVulns({
      vulnIds: ['v1', 'v2', 'v3'],
      action: 'ACCEPT_PATCH',
    });

    expect(result.applied).toBe(2);
    expect(result.skipped).toBe(1);
    expect(result.appliedVulnIds).toHaveLength(2);
    expect(result.appliedVulnIds).not.toContain('v3');
  });
});
