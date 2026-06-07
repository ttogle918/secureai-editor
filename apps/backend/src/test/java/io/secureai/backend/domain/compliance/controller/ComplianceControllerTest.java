package io.secureai.backend.domain.compliance.controller;

import io.secureai.backend.domain.compliance.dto.ComplianceResponse;
import io.secureai.backend.domain.compliance.service.ComplianceMappingService;
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
class ComplianceControllerTest {

    @Mock ComplianceMappingService complianceMappingService;

    private ComplianceController controller;
    private final UUID userId = UUID.randomUUID();
    private final UUID projectId = UUID.randomUUID();
    private final UUID sessionId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        controller = new ComplianceController(complianceMappingService);
    }

    @Test
    @DisplayName("getCompliance — 유효한 framework 는 매핑 결과를 200 으로 반환한다")
    void getCompliance_validFramework() {
        String framework = ComplianceMappingService.FRAMEWORK_NIST_CSF;
        ComplianceResponse report = mock(ComplianceResponse.class);
        when(complianceMappingService.getComplianceReport(projectId, sessionId, framework, userId))
                .thenReturn(report);

        var response = controller.getCompliance(projectId, sessionId, framework, userId);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().getData()).isSameAs(report);
    }

    @Test
    @DisplayName("getCompliance — 지원하지 않는 framework 는 INVALID_INPUT 으로 거부한다")
    void getCompliance_invalidFramework_throws() {
        assertThatThrownBy(() ->
                controller.getCompliance(projectId, sessionId, "PCI_DSS", userId))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getErrorCode())
                        .isEqualTo(ErrorCode.INVALID_INPUT));
        verifyNoInteractions(complianceMappingService);
    }
}
