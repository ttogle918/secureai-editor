package io.secureai.backend.config;

import lombok.Getter;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;

/**
 * GitHub 연동 설정.
 *
 * application.yml의 secureai.github.* 키를 바인딩한다.
 * webhookSecret, appPrivateKey는 절대 로그에 출력하지 않는다.
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

    /**
     * GitHub App ID (Check Run 생성 + Installation Token 교환에 사용).
     * OAuth Client ID와 별개임에 주의: App ID는 숫자(예: "123456"),
     * Client ID는 "Iv1.xxxxx" 형식의 OAuth 앱 식별자이다.
     */
    private String checkRunAppId = "";

    /**
     * GitHub App RSA Private Key (PEM 인라인 — 환경변수 GITHUB_APP_PRIVATE_KEY로 주입).
     * 절대 로그 출력 금지. appPrivateKeyPath와 상호 배타적으로 사용한다.
     */
    private String appPrivateKey = "";

    /**
     * GitHub App RSA Private Key 파일 경로 (환경변수 GITHUB_APP_PRIVATE_KEY_PATH로 주입).
     * appPrivateKey가 비어 있을 때 이 경로에서 PEM을 읽는다.
     */
    private String appPrivateKeyPath = "";

    /** critical 취약점 발견 시 머지 차단 여부 */
    private boolean blockMergeOnCritical = true;

    /**
     * Webhook HMAC-SHA256 검증용 Mac 빈.
     *
     * webhookSecret으로 초기화된 Mac 인스턴스를 제공한다.
     * 빈 secret이면:
     *  - 운영(prod) 프로파일: 부팅을 실패시켜(fail-fast) 서명 검증이 비활성화된 채
     *    웹훅이 무인증으로 열리는 것을 원천 차단한다.
     *  - 그 외(dev/local/test): 경고 로그만 남기고 null을 반환해
     *    호출 측에서 검증 스킵 여부를 판단한다(로컬 개발 편의).
     *
     * @param environment 활성 프로파일 확인용
     */
    @Bean(name = "webhookMac")
    public Mac webhookMac(Environment environment) {
        if (webhookSecret == null || webhookSecret.isBlank()) {
            boolean isProd = environment.acceptsProfiles(Profiles.of("prod"));
            if (isProd) {
                throw new IllegalStateException(
                        "운영(prod) 환경에서 secureai.github.webhook-secret이 설정되지 않았습니다. " +
                        "GitHub Webhook 서명 검증을 비활성화할 수 없습니다. 시크릿을 반드시 설정하세요.");
            }
            log.warn("[github-config] secureai.github.webhook-secret이 설정되지 않았습니다. " +
                     "운영 환경에서는 반드시 설정해야 합니다. (현재 비-운영 프로파일 — 서명 검증 스킵 허용)");
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
