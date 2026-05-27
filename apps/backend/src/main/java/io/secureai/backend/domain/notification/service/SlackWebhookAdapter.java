package io.secureai.backend.domain.notification.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

/**
 * Slack Incoming Webhook을 통해 알림을 발송하는 어댑터.
 *
 * <p>{@code secureai.slack.webhook-url} 이 설정된 경우에만 활성화된다.
 * 미설정 시 {@link SlackNotificationNoOp}가 폴백으로 등록된다.
 *
 * <p>DIP: {@link SlackNotificationPort} 인터페이스에 의존하도록 호출자를 구성한다.
 */
@Slf4j
@Component
@ConditionalOnProperty(name = "secureai.slack.webhook-url", matchIfMissing = false)
public class SlackWebhookAdapter implements SlackNotificationPort {

    private static final String SLACK_PAYLOAD_TEMPLATE =
            "{\"text\":\"%s\"}";

    private final WebClient webClient;
    private final String webhookUrl;

    public SlackWebhookAdapter(
            WebClient.Builder webClientBuilder,
            @Value("${secureai.slack.webhook-url}") String webhookUrl) {
        this.webClient = webClientBuilder.build();
        this.webhookUrl = webhookUrl;
    }

    @Override
    public void sendSslExpiryAlert(String domain, int daysRemaining) {
        String message = String.format(
                "[SecureAI] SSL 인증서 만료 임박 — 도메인: %s, 잔여: %d일", domain, daysRemaining);
        postMessage(message);
    }

    @Override
    public void sendMonitoringDownAlert(String domain, String errorMessage) {
        String message = String.format(
                "[SecureAI] 모니터링 다운 감지 — 도메인: %s, 원인: %s", domain, errorMessage);
        postMessage(message);
    }

    @Override
    public void sendNightlyScanResult(String projectName, String summary) {
        String message = String.format(
                "[SecureAI] 야간 자동 스캔 완료 — 프로젝트: %s, 결과: %s", projectName, summary);
        postMessage(message);
    }

    private void postMessage(String text) {
        // 슬래시·따옴표 이스케이프 처리 (JSON 직렬화 안전)
        String escapedText = text.replace("\"", "\\\"");
        String payload = String.format(SLACK_PAYLOAD_TEMPLATE, escapedText);

        webClient.post()
                .uri(webhookUrl)
                .header("Content-Type", "application/json")
                .bodyValue(payload)
                .retrieve()
                .toBodilessEntity()
                .subscribe(
                        response -> log.debug("[slack] 알림 발송 성공 statusCode={}", response.getStatusCode()),
                        error -> log.error("[slack] 알림 발송 실패 reason={}", error.getMessage())
                );
    }
}
