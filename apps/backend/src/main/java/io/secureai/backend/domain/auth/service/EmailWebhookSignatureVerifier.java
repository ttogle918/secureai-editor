package io.secureai.backend.domain.auth.service;

import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * 이메일 바운스 웹훅 서명 검증기.
 *
 * 임의 외부인이 suppression 목록을 조작(메일 차단 DoS)하지 못하도록 공유 시크릿으로 보호한다.
 * X-Webhook-Secret 헤더 값과 환경변수 EMAIL_WEBHOOK_SECRET를 비교한다.
 *
 * fail-closed in prod: prod 프로파일에서 시크릿 미설정 시 기동 단계에서 예외를 던져
 * 무서명 개방 상태로 배포되는 것을 차단한다(배포 파이프라인에서 포착). dev/CI에서는 미설정 허용.
 */
@Slf4j
@Component
public class EmailWebhookSignatureVerifier {

    private static final String PROD_PROFILE = "prod";

    private final String webhookSecret;
    private final Environment environment;

    public EmailWebhookSignatureVerifier(
            @Value("${secureai.email.webhook-secret:}") String webhookSecret,
            Environment environment) {
        this.webhookSecret = webhookSecret;
        this.environment = environment;
    }

    /**
     * prod 프로파일에서 시크릿이 비어 있으면 기동을 중단한다(fail-closed).
     * dev/CI에서는 미설정을 허용하되 verify() 호출 시 경고만 남긴다.
     */
    @PostConstruct
    void enforceProdSecret() {
        boolean isProd = environment.acceptsProfiles(org.springframework.core.env.Profiles.of(PROD_PROFILE));
        if (isProd && (webhookSecret == null || webhookSecret.isBlank())) {
            throw new IllegalStateException(
                    "EMAIL_WEBHOOK_SECRET must be set in prod — 미설정 시 바운스 웹훅이 무서명 개방됩니다");
        }
    }

    /**
     * X-Webhook-Secret 헤더 값을 검증한다.
     * 실패 시 BusinessException(EMAIL_WEBHOOK_INVALID)을 던진다.
     */
    public void verify(String providedSecret) {
        if (webhookSecret == null || webhookSecret.isBlank()) {
            // 개발/CI 환경에서 시크릿 미설정 허용 — 경고 로그 필수
            log.warn("[email-webhook] EMAIL_WEBHOOK_SECRET not configured — skipping signature check");
            return;
        }
        if (!constantTimeEquals(webhookSecret, providedSecret)) {
            log.warn("[email-webhook] invalid signature received");
            throw new BusinessException(ErrorCode.EMAIL_WEBHOOK_INVALID);
        }
    }

    /**
     * 타이밍 공격 방어를 위한 상수 시간 비교.
     * MessageDigest.isEqual은 길이가 다를 때도 일정 시간 보장.
     */
    private boolean constantTimeEquals(String expected, String provided) {
        if (provided == null) {
            return false;
        }
        byte[] expectedBytes = expected.getBytes(StandardCharsets.UTF_8);
        byte[] providedBytes = provided.getBytes(StandardCharsets.UTF_8);
        return MessageDigest.isEqual(expectedBytes, providedBytes);
    }
}
