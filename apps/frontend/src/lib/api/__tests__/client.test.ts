import {
  apiClient,
  ApiError,
  setAccessToken,
  getAccessToken,
  onUnauthorized,
  BASE_URL,
} from '../client';

// ── fetch mock helpers ────────────────────────────────────────────────────────

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

// ── token store ────────────────────────────────────────────────────────────────

describe('access token store', () => {
  it('round-trips the access token', () => {
    setAccessToken('abc');
    expect(getAccessToken()).toBe('abc');
    setAccessToken(null);
    expect(getAccessToken()).toBeNull();
  });
});

// ── request basics ───────────────────────────────────────────────────────────

describe('apiClient request', () => {
  it('sends JSON body, credentials and Content-Type on POST', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true }));

    await apiClient.post('/things', { a: 1 });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/things`);
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
  });

  it('attaches the Authorization header when a token is set', async () => {
    setAccessToken('tok-123');
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));

    await apiClient.get('/me');

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer tok-123');
  });

  it('returns undefined for 204 No Content', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(204, undefined));
    const result = await apiClient.delete('/things/1');
    expect(result).toBeUndefined();
  });

  it('maps an error body to ApiError (code + detail)', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(400, { error: { code: 'VALIDATION', detail: 'bad input' } }),
    );

    await expect(apiClient.get('/things')).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      code: 'VALIDATION',
      message: 'bad input',
    });
  });

  it('falls back to UNKNOWN code when the error body is not JSON', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      json: async () => { throw new Error('not json'); },
    } as unknown as Response);

    await expect(apiClient.get('/boom')).rejects.toMatchObject({
      status: 500,
      code: 'UNKNOWN',
    });
  });
});

// ── 401 refresh-and-retry ──────────────────────────────────────────────────────

describe('401 handling', () => {
  it('refreshes the token and retries the original request once', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, {}))                                // original
      .mockResolvedValueOnce(jsonResponse(200, { data: { accessToken: 'new-tok' } })) // refresh
      .mockResolvedValueOnce(jsonResponse(200, { data: 'ok' }));                   // retry

    const result = await apiClient.get<{ data: string }>('/secure');

    expect(result).toEqual({ data: 'ok' });
    // refresh hit the refresh endpoint
    expect(fetchMock.mock.calls[1][0]).toBe(`${BASE_URL}/auth/refresh`);
    // retry carried the freshly-minted token
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe('Bearer new-tok');
    expect(getAccessToken()).toBe('new-tok');
  });

  it('throws ApiError(401) and notifies unauthorized handlers when refresh fails', async () => {
    const handler = jest.fn();
    const unsub = onUnauthorized(handler);

    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, {}))   // original
      .mockResolvedValueOnce(jsonResponse(401, {}));  // refresh also fails

    await expect(apiClient.get('/secure')).rejects.toMatchObject({
      status: 401,
      code: 'AUTH_TOKEN_EXPIRED',
    });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(getAccessToken()).toBeNull();

    unsub();
  });

  it('onUnauthorized returns an unsubscribe that detaches the handler', async () => {
    const handler = jest.fn();
    const unsub = onUnauthorized(handler);
    unsub();

    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, {}))
      .mockResolvedValueOnce(jsonResponse(401, {}));

    await expect(apiClient.get('/secure')).rejects.toBeInstanceOf(ApiError);
    expect(handler).not.toHaveBeenCalled();
  });
});
