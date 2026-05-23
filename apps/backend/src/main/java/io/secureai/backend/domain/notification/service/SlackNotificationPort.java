package io.secureai.backend.domain.notification.service;

/**
 * Slack Webhook 발송 포트 인터페이스.
 *
 * <p>webhook URL 설정 시 {@link SlackWebhookAdapter}, 미설정 시 {@link SlackNotificationNoOp}가
 * 구현체로 등록된다.
 */
public interface SlackNotificationPort {

    /**
     * SSL 인증서 만료 임박 알림을 발송한다.
     *
     * @param domain        대상 도메인
     * @param daysRemaining 만료까지 남은 일수
     */
    void sendSslExpiryAlert(String domain, int daysRemaining);

    /**
     * 모니터링 대상 다운(응답 없음) 알림을 발송한다.
     *
     * @param domain       대상 도메인
     * @param errorMessage 연결 실패 원인 메시지
     */
    void sendMonitoringDownAlert(String domain, String errorMessage);
}
