/**
 * Sentry 클라이언트 설정 (TASK-1804)
 * NEXT_PUBLIC_SENTRY_DSN 미설정 시 init 스킵 — 로컬/CI 무해
 *
 * 보안: beforeSend 훅으로 JWT/Authorization/X-Internal-Key/password 스크럽
 * Access Token은 메모리에만 보관하므로 request body/header에 포함 가능성 있음
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // PII 자동 수집 비활성화
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
    environment: process.env.NODE_ENV,
    beforeSend(event) {
      return scrubSentryEvent(event);
    },
  });
}

/** 민감 데이터가 Sentry로 전송되지 않도록 이벤트를 정제한다. */
function scrubSentryEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  const request = event.request;
  if (!request) {
    return event;
  }

  scrubHeaders(request.headers);
  scrubCookies(request);
  return event;
}

const SENSITIVE_HEADERS = new Set([
  "authorization",
  "x-internal-key",
  "cookie",
  "set-cookie",
  "x-api-key",
]);

function scrubHeaders(
  headers: Record<string, string> | undefined
): void {
  if (!headers) {
    return;
  }
  for (const key of Object.keys(headers)) {
    if (SENSITIVE_HEADERS.has(key.toLowerCase())) {
      headers[key] = "[REDACTED]";
    }
  }
}

function scrubCookies(request: Sentry.Request): void {
  if (!request.cookies) {
    return;
  }
  // 쿠키 전체 마스킹 — 세션 토큰 포함 가능. Sentry는 cookies를 객체 또는
  // 원본 문자열로 전달할 수 있으므로 두 형태 모두 마스킹한다(문자열 누락 시 누출).
  if (typeof request.cookies === "object") {
    for (const key of Object.keys(request.cookies)) {
      request.cookies[key] = "[REDACTED]";
    }
  } else {
    request.cookies = "[REDACTED]";
  }
}
