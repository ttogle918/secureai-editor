package io.secureai.backend.domain.notification.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.stereotype.Component;

/**
 * Slack webhook URL 미설정 시 활성화되는 no-op 폴백.
 *
 * <p>{@link SlackWebhookAdapter} 빈이 등록되지 않은 개발/테스트 환경에서
 * 실제 HTTP 요청 없이 debug 로그만 기록한다.
 */
@Slf4j
@Component
@ConditionalOnMissingBean(SlackWebhookAdapter.class)
public class SlackNotificationNoOp implements SlackNotificationPort {

    @Override
    public void sendSslExpiryAlert(String domain, int daysRemaining) {
        log.debug("[slack-noop] SSL 만료 임박 알림 생략 domain={} daysRemaining={}", domain, daysRemaining);
    }

    @Override
    public void sendMonitoringDownAlert(String domain, String errorMessage) {
        log.debug("[slack-noop] 다운 알림 생략 domain={}", domain);
    }

    @Override
    public void sendNightlyScanResult(String projectName, String summary) {
        log.debug("[slack-noop] 야간 스캔 결과 알림 생략 project={}", projectName);
    }
}
