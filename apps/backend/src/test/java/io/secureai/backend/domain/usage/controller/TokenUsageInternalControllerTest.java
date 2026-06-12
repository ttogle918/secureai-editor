package io.secureai.backend.domain.usage.controller;

import io.secureai.backend.domain.usage.dto.ReportTokenUsageRequest;
import io.secureai.backend.domain.usage.service.TokenUsageService;
import io.secureai.backend.global.response.ApiResponse;
import jakarta.validation.ConstraintViolationException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * TokenUsageInternalController 단위 테스트 (COST-3).
 *
 * Controller 레이어 위임 검증.
 * 입력 검증은 Jakarta Bean Validation 이 담당하므로 여기서는 서비스 위임만 확인.
 */
@ExtendWith(MockitoExtension.class)
class TokenUsageInternalControllerTest {

    @Mock TokenUsageService tokenUsageService;

    private TokenUsageInternalController controller;

    private static final UUID SESSION_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID USER_ID    = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private static final UUID PROJECT_ID = UUID.fromString("33333333-3333-3333-3333-333333333333");

    @BeforeEach
    void setUp() {
        controller = new TokenUsageInternalController(tokenUsageService);
    }

    @Test
    @DisplayName("유효한 요청 — 201 Created 반환 및 TokenUsageService.record 위임")
    void reportTokenUsage_validRequest_returns201AndDelegates() {
        // given
        ReportTokenUsageRequest req = new ReportTokenUsageRequest(
                USER_ID, PROJECT_ID, "anthropic", "claude-haiku-4-5",
                1000L, 500L, 200L, 100L
        );

        // when
        ResponseEntity<ApiResponse<Map<String, String>>> response =
                controller.reportTokenUsage(SESSION_ID, req);

        // then
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().isSuccess()).isTrue();
        assertThat(response.getBody().getData()).containsEntry("status", "recorded");

        ArgumentCaptor<ReportTokenUsageRequest> captor =
                ArgumentCaptor.forClass(ReportTokenUsageRequest.class);
        verify(tokenUsageService).record(eq(SESSION_ID), captor.capture());
        assertThat(captor.getValue().provider()).isEqualTo("anthropic");
    }

    @Test
    @DisplayName("gemini provider — 서비스에 정확한 provider 값이 전달된다")
    void reportTokenUsage_geminiProvider_passesProviderToService() {
        // given
        ReportTokenUsageRequest req = new ReportTokenUsageRequest(
                USER_ID, PROJECT_ID, "gemini", "gemini-2.5-flash",
                2000L, 800L, 0L, 400L
        );

        // when
        controller.reportTokenUsage(SESSION_ID, req);

        // then
        ArgumentCaptor<ReportTokenUsageRequest> captor =
                ArgumentCaptor.forClass(ReportTokenUsageRequest.class);
        verify(tokenUsageService).record(eq(SESSION_ID), captor.capture());
        assertThat(captor.getValue().provider()).isEqualTo("gemini");
        assertThat(captor.getValue().model()).isEqualTo("gemini-2.5-flash");
    }
}
