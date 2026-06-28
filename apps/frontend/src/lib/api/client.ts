export const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api/v1';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ── Token store (메모리 전용 — localStorage 저장 안 함) ──────────────────────
let _accessToken: string | null = null;
let _refreshing: Promise<string | null> | null = null;
const _unauthorizedHandlers: Array<() => void> = [];

export function setAccessToken(token: string | null) {
  _accessToken = token;
}

export function getAccessToken() {
  return _accessToken;
}

export function onUnauthorized(handler: () => void): () => void {
  _unauthorizedHandlers.push(handler);
  return () => {
    const idx = _unauthorizedHandlers.indexOf(handler);
    if (idx >= 0) _unauthorizedHandlers.splice(idx, 1);
  };
}

async function tryRefresh(): Promise<string | null> {
  if (_refreshing) return _refreshing;
  _refreshing = fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })
    .then(async (res) => {
      if (!res.ok) throw new Error('refresh failed');
      const json = await res.json();
      const token: string | null = json?.data?.accessToken ?? null;
      _accessToken = token;
      return token;
    })
    .catch(() => {
      _accessToken = null;
      _unauthorizedHandlers.forEach((h) => h());
      return null;
    })
    .finally(() => { _refreshing = null; });
  return _refreshing;
}

// ── Core request ─────────────────────────────────────────────────────────────

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  token?: string;
  _retry?: boolean;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, token, headers: extraHeaders, _retry, ...rest } = options;

  const authToken = token ?? _accessToken;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...(extraHeaders as Record<string, string> ?? {}),
  };

  const res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    credentials: 'include',
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && !_retry) {
    const newToken = await tryRefresh();
    if (newToken) {
      return request<T>(path, { ...options, token: newToken, _retry: true });
    }
    throw new ApiError(401, 'AUTH_TOKEN_EXPIRED', 'Unauthorized');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ code: 'UNKNOWN', message: res.statusText }));
    const message = err.error?.detail ?? err.error?.message ?? err.message ?? res.statusText;
    throw new ApiError(res.status, err.error?.code ?? err.code ?? 'UNKNOWN', message);
  }

  if (res.status === 204) return undefined as T;
  // 202 Accepted 등 빈 본문 2xx 응답은 res.json()이 빈 문자열에서 throw 하므로
  // 본문이 있을 때만 파싱한다. (예: POST /dast/batch 는 202 + 빈 본문)
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const apiClient = {
  get:    <T>(path: string, opts?: RequestOptions) =>
    request<T>(path, { method: 'GET', ...opts }),
  post:   <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { method: 'POST', body, ...opts }),
  put:    <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { method: 'PUT', body, ...opts }),
  patch:  <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { method: 'PATCH', body, ...opts }),
  delete: <T>(path: string, opts?: RequestOptions) =>
    request<T>(path, { method: 'DELETE', ...opts }),
};
