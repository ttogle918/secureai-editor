/**
 * Sentry 서버(Next.js SSR/API Route) 설정 (TASK-1804)
 * SENTRY_DSN 미설정 시 init 스킵 — 로컬/CI 무해
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
    environment: process.env.NODE_ENV,
    beforeSend(event) {
      // 서버 사이드 요청에서 Authorization 헤더 스크럽
      const request = event.request;
      if (request?.headers) {
        const sensitiveKeys = [
          "authorization",
          "x-internal-key",
          "cookie",
          "set-cookie",
          "x-api-key",
        ];
        for (const key of Object.keys(request.headers)) {
          if (sensitiveKeys.includes(key.toLowerCase())) {
            request.headers[key] = "[REDACTED]";
          }
        }
      }
      return event;
    },
  });
}
