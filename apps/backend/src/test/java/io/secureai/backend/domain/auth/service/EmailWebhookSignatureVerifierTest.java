package io.secureai.backend.domain.auth.service;

import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

import static org.assertj.core.api.Assertions.*;

class EmailWebhookSignatureVerifierTest {

    /** 기본: 비-prod 프로파일 → enforceProdSecret 가드 미발동. */
    private EmailWebhookSignatureVerifier newVerifier(String secret) {
        return new EmailWebhookSignatureVerifier(secret, new MockEnvironment());
    }

    private EmailWebhookSignatureVerifier newProdVerifier(String secret) {
        MockEnvironment prod = new MockEnvironment();
        prod.setActiveProfiles("prod");
        return new EmailWebhookSignatureVerifier(secret, prod);
    }

    @Test
    @DisplayName("올바른 시크릿이면 예외가 발생하지 않는다")
    void verify_validSecret_passes() {
        EmailWebhookSignatureVerifier verifier = newVerifier("super-secret");
        assertThatCode(() -> verifier.verify("super-secret")).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("잘못된 시크릿이면 EMAIL_WEBHOOK_INVALID 예외가 발생한다")
    void verify_invalidSecret_throwsEmailWebhookInvalid() {
        EmailWebhookSignatureVerifier verifier = newVerifier("super-secret");

        assertThatThrownBy(() -> verifier.verify("wrong"))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.EMAIL_WEBHOOK_INVALID);
    }

    @Test
    @DisplayName("null 시크릿이면 EMAIL_WEBHOOK_INVALID 예외가 발생한다")
    void verify_nullSecret_throwsEmailWebhookInvalid() {
        EmailWebhookSignatureVerifier verifier = newVerifier("super-secret");

        assertThatThrownBy(() -> verifier.verify(null))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.EMAIL_WEBHOOK_INVALID);
    }

    @Test
    @DisplayName("환경 변수 미설정(빈 문자열) 시 서명 검증을 건너뛴다 (개발 편의 — env-gate)")
    void verify_emptyConfiguredSecret_skipsCheck() {
        EmailWebhookSignatureVerifier verifier = newVerifier("");
        // 어떤 값이 와도 통과해야 한다
        assertThatCode(() -> verifier.verify("anything")).doesNotThrowAnyException();
        assertThatCode(() -> verifier.verify(null)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("null로 설정된 환경 변수 시 서명 검증을 건너뛴다")
    void verify_nullConfiguredSecret_skipsCheck() {
        EmailWebhookSignatureVerifier verifier = newVerifier(null);
        assertThatCode(() -> verifier.verify("anything")).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("prod 프로파일 + 시크릿 미설정이면 기동 가드가 예외를 던진다 (fail-closed)")
    void enforceProdSecret_prodWithoutSecret_throws() {
        EmailWebhookSignatureVerifier verifier = newProdVerifier("");
        assertThatThrownBy(verifier::enforceProdSecret)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("EMAIL_WEBHOOK_SECRET");
    }

    @Test
    @DisplayName("prod 프로파일이라도 시크릿이 설정돼 있으면 기동 가드를 통과한다")
    void enforceProdSecret_prodWithSecret_passes() {
        EmailWebhookSignatureVerifier verifier = newProdVerifier("super-secret");
        assertThatCode(verifier::enforceProdSecret).doesNotThrowAnyException();
    }
}
