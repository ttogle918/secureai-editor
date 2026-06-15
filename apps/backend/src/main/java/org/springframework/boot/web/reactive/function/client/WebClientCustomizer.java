/*
 * Boot4 × Sentry 호환 shim — 삭제 조건: Sentry SDK가 Boot4 패키지를 참조하도록 수정되면 제거.
 *
 * Sentry SentrySpanWebClientCustomizer 가 implements 하는 구 FQCN 인터페이스.
 * Boot4에서 패키지가 재배치되어 이 경로에는 더 이상 존재하지 않으므로, Sentry 빈 클래스 로딩 시
 * 인터페이스 링킹 실패를 막기 위해 동일 시그니처(SAM)로 재현한다.
 * Sentry가 생성하는 customizer 빈은 본 프로젝트에서 소비되지 않는다(no-op).
 * 상세: docs/troubleshooting/2026-06-15_sentry-boot4-webclient-compat.md
 */
package org.springframework.boot.web.reactive.function.client;

import org.springframework.web.reactive.function.client.WebClient;

@FunctionalInterface
public interface WebClientCustomizer {
    void customize(WebClient.Builder webClientBuilder);
}
