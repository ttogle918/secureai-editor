package io.secureai.backend.config;

import lombok.Getter;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;

/**
 * GitHub 연동 설정.
 *
 * application.yml의 secureai.github.* 키를 바인딩한다.
 * webhookSecret은 절대 로그에 출력하지 않는다.
 */
@Slf4j
@Configuration
@ConfigurationProperties(prefix = "secureai.github")
@Getter
@Setter
public class GitHubConfig {

    private static final String HMAC_ALGORITHM = "HmacSHA256";

    /** GitHub Webhook Secret (설정 없으면 빈 문자열 — 운영 환경에서 반드시 설정 필요) */
    private String webhookSecret = "";

    /** GitHub App ID (Check Run 생성에 사용) */
    private String checkRunAppId = "";

    /** critical 취약점 발견 시 머지 차단 여부 */
    private boolean blockMergeOnCritical = true;

    /**
     * Webhook HMAC-SHA256 검증용 Mac 빈.
     *
     * webhookSecret으로 초기화된 Mac 인스턴스를 제공한다.
     * 빈 secret이면 경고 로그만 남기고 null을 반환해
     * 호출 측에서 검증 스킵 여부를 판단한다.
     */
    @Bean(name = "webhookMac")
    public Mac webhookMac() {
        if (webhookSecret == null || webhookSecret.isBlank()) {
            log.warn("[github-config] secureai.github.webhook-secret이 설정되지 않았습니다. " +
                     "운영 환경에서는 반드시 설정해야 합니다.");
            return null;
        }
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            SecretKeySpec keySpec = new SecretKeySpec(
                    webhookSecret.getBytes(StandardCharsets.UTF_8), HMAC_ALGORITHM
            );
            mac.init(keySpec);
            return mac;
        } catch (Exception e) {
            log.error("[github-config] HMAC Mac 초기화 실패: {}", e.getMessage());
            throw new IllegalStateException("GitHub Webhook HMAC 초기화 실패", e);
        }
    }
}
