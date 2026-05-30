package io.secureai.backend.domain.user.controller;

import io.secureai.backend.domain.user.dto.TotpSetupResponse;
import io.secureai.backend.domain.user.dto.TotpVerifyRequest;
import io.secureai.backend.domain.user.dto.TotpVerifyResponse;
import io.secureai.backend.domain.user.service.TotpService;
import io.secureai.backend.global.response.ApiResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * TotpController 단위 테스트 — 2FA 설정/검증/해제 위임과 상태코드를 확인한다.
 * userId 는 @AuthenticationPrincipal 에서만 받으므로 위임 인자로 검증한다.
 */
@ExtendWith(MockitoExtension.class)
class TotpControllerTest {

    @Mock TotpService totpService;

    private TotpController controller;
    private final UUID userId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        controller = new TotpController(totpService);
    }

    @Test
    @DisplayName("setup — 인증 주체로 TOTP 설정을 초기화하고 결과를 200 으로 반환한다")
    void setup_returnsSetupResponse() {
        TotpSetupResponse expected = mock(TotpSetupResponse.class);
        when(totpService.setupTotp(userId)).thenReturn(expected);

        ResponseEntity<ApiResponse<TotpSetupResponse>> response = controller.setup(userId);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().getData()).isSameAs(expected);
    }

    @Test
    @DisplayName("verify — 제출한 코드를 서비스에 전달하고 검증 결과를 반환한다")
    void verify_passesCode() {
        TotpVerifyResponse expected = mock(TotpVerifyResponse.class);
        when(totpService.verifyAndEnable(userId, "123456")).thenReturn(expected);

        ResponseEntity<ApiResponse<TotpVerifyResponse>> response =
                controller.verify(userId, new TotpVerifyRequest("123456"));

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().getData()).isSameAs(expected);
        verify(totpService).verifyAndEnable(userId, "123456");
    }

    @Test
    @DisplayName("disable — 2FA 해제를 위임하고 204 를 반환한다")
    void disable_returns204() {
        ResponseEntity<Void> response = controller.disable(userId);

        assertThat(response.getStatusCode().value()).isEqualTo(204);
        verify(totpService).disable(userId);
    }
}
