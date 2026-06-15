package io.secureai.backend.domain.auth.controller;

import io.secureai.backend.domain.auth.dto.BounceWebhookRequest;
import io.secureai.backend.domain.auth.entity.SuppressionReason;
import io.secureai.backend.domain.auth.service.EmailSuppressionService;
import io.secureai.backend.domain.auth.service.EmailWebhookSignatureVerifier;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EmailWebhookControllerTest {

    @Mock EmailWebhookSignatureVerifier signatureVerifier;
    @Mock EmailSuppressionService suppressionService;

    private EmailWebhookController controller;

    @BeforeEach
    void setUp() {
        controller = new EmailWebhookController(signatureVerifier, suppressionService);
    }

    @Test
    @DisplayName("유효한 서명 + BOUNCE reason → 200 OK 및 suppression 등록")
    void receiveBounce_validSecret_registersSuppressionAndReturns200() {
        var request = new BounceWebhookRequest("bounce@x.com", "BOUNCE");

        var response = controller.receiveBounce("valid-secret", request);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        verify(signatureVerifier).verify("valid-secret");
        verify(suppressionService).suppress("bounce@x.com", SuppressionReason.BOUNCE);
    }

    @Test
    @DisplayName("유효한 서명 + COMPLAINT reason → suppression 등록")
    void receiveBounce_complaintReason_registersComplaint() {
        var request = new BounceWebhookRequest("spam@x.com", "COMPLAINT");

        controller.receiveBounce("valid-secret", request);

        verify(suppressionService).suppress("spam@x.com", SuppressionReason.COMPLAINT);
    }

    @Test
    @DisplayName("서명 검증 실패(signatureVerifier가 예외 던짐) → 예외가 컨트롤러 밖으로 전파된다")
    void receiveBounce_invalidSecret_throwsException() {
        doThrow(new BusinessException(ErrorCode.EMAIL_WEBHOOK_INVALID))
                .when(signatureVerifier).verify("wrong-secret");

        var request = new BounceWebhookRequest("x@x.com", "BOUNCE");

        assertThatThrownBy(() -> controller.receiveBounce("wrong-secret", request))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.EMAIL_WEBHOOK_INVALID);

        // suppression 등록 로직이 호출되지 않았는지 확인
        verify(suppressionService, never()).suppress(any(), any());
    }

    @Test
    @DisplayName("secret 헤더 누락(null) + 시크릿 미설정 환경 → signatureVerifier가 pass (env-gate)")
    void receiveBounce_missingSecret_delegatesToVerifier() {
        // signatureVerifier.verify(null) 호출 — 동작은 verifier 구현 책임 (env-gate)
        var request = new BounceWebhookRequest("x@x.com", "BOUNCE");

        controller.receiveBounce(null, request);

        verify(signatureVerifier).verify(null);
    }
}
