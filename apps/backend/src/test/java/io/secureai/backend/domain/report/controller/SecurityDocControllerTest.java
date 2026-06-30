package io.secureai.backend.domain.report.controller;

import io.secureai.backend.domain.report.dto.SecurityDocResponse;
import io.secureai.backend.domain.report.entity.DocType;
import io.secureai.backend.domain.report.service.SecurityDocService;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SecurityDocControllerTest {

    @Mock SecurityDocService securityDocService;

    private SecurityDocController controller;
    private final UUID userId = UUID.randomUUID();
    private final UUID projectId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        controller = new SecurityDocController(securityDocService);
    }

    @Test
    @DisplayName("createSecurityDoc — 유효한 type(대소문자 무시)을 DocType 으로 파싱해 202 로 응답한다")
    void createSecurityDoc_validType_returns202() {
        SecurityDocResponse pending = mock(SecurityDocResponse.class);
        when(securityDocService.createRequest(projectId, userId, DocType.CISO, null)).thenReturn(pending);

        var response = controller.createSecurityDoc(userId, projectId, "ciso", null);

        assertThat(response.getStatusCode().value()).isEqualTo(202);
        assertThat(response.getBody().getData()).isSameAs(pending);
    }

    @Test
    @DisplayName("createSecurityDoc — 지원하지 않는 type 은 INVALID_INPUT 으로 거부한다")
    void createSecurityDoc_invalidType_throws() {
        assertThatThrownBy(() -> controller.createSecurityDoc(userId, projectId, "BOGUS", null))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getErrorCode())
                        .isEqualTo(ErrorCode.INVALID_INPUT));
        verifyNoInteractions(securityDocService);
    }

    @Test
    @DisplayName("getStatus — requestId + userId 로 상태를 위임하고 200 을 반환한다")
    void getStatus_delegates() {
        UUID requestId = UUID.randomUUID();
        SecurityDocResponse status = mock(SecurityDocResponse.class);
        when(securityDocService.getStatus(requestId, userId)).thenReturn(status);

        var response = controller.getStatus(userId, projectId, requestId);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().getData()).isSameAs(status);
    }
}
