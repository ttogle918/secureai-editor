/*
 * Boot4 × Sentry 호환 shim — 삭제 조건: Sentry SDK가 Boot4 autoconfigure 패키지를 참조하도록 수정되면 제거.
 * Sentry SentryPerformanceRestTemplateConfiguration 의 @AutoConfigureAfter 가 참조하는 구 FQCN.
 * (Boot4에서 제거됨 → ClassNotFoundException 방지용 빈 클래스.)
 * 상세: docs/troubleshooting/2026-06-15_sentry-boot4-webclient-compat.md
 */
package org.springframework.boot.autoconfigure.web.client;

public class RestTemplateAutoConfiguration {
}
