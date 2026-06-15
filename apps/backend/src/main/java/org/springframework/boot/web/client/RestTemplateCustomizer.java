/*
 * Boot4 × Sentry 호환 shim — 삭제 조건: Sentry SDK가 Boot4 패키지를 참조하도록 수정되면 제거.
 * Sentry SentrySpanRestTemplateCustomizer 가 implements 하는 구 FQCN 인터페이스(SAM 재현).
 * 상세: docs/troubleshooting/2026-06-15_sentry-boot4-webclient-compat.md
 */
package org.springframework.boot.web.client;

import org.springframework.web.client.RestTemplate;

@FunctionalInterface
public interface RestTemplateCustomizer {
    void customize(RestTemplate restTemplate);
}
