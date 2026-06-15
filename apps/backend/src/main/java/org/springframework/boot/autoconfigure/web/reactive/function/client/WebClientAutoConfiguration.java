/*
 * Boot4 × Sentry 호환 shim — 삭제 조건: Sentry SDK가 Boot4 autoconfigure 패키지를 참조하도록 수정되면 제거.
 *
 * 왜 존재하는가:
 *   Spring Boot 4는 autoconfigure 클래스를 per-feature 모듈/패키지(org.springframework.boot.X.autoconfigure)
 *   로 재배치하면서 구(舊) FQCN을 제거했다. 그러나 sentry-spring-boot-starter-jakarta(8.43.2 포함)는
 *   SentryAutoConfiguration$HubConfiguration$SentryPerformanceWebClientConfiguration 의
 *   @AutoConfigureAfter 메타데이터에서 이 구 FQCN을 그대로 참조한다. WebClient가 클래스패스에 있으면
 *   (본 프로젝트는 MonitoringService/SlackWebhookAdapter에서 사용) 해당 설정이 활성화되고,
 *   bean name 생성 단계에서 이 클래스를 로드하지 못해 ClassNotFoundException → 전체 컨텍스트 로딩 실패.
 *
 * 역할: 단지 FQCN이 "존재"하기만 하면 되는 ordering 메타데이터 참조이므로 빈 클래스로 충분하다.
 *   (Spring은 이 클래스를 인스턴스화하지 않는다 — AutoConfiguration.imports에 등록되지 않음.)
 *
 * 상세: docs/troubleshooting/2026-06-15_sentry-boot4-webclient-compat.md
 */
package org.springframework.boot.autoconfigure.web.reactive.function.client;

public class WebClientAutoConfiguration {
}
