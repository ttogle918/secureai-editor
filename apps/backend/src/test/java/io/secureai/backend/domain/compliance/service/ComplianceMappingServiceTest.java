package io.secureai.backend.domain.compliance.service;

import io.secureai.backend.domain.analysis.service.VulnerabilityQueryService;
import io.secureai.backend.domain.compliance.dto.ComplianceResponse;
import io.secureai.backend.domain.project.service.ProjectService;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.BDDMockito.given;

@ExtendWith(MockitoExtension.class)
@DisplayName("ComplianceMappingService 단위 테스트")
class ComplianceMappingServiceTest {

    @Mock VulnerabilityQueryService vulnerabilityQueryService;
    @Mock ProjectService projectService;

    @InjectMocks ComplianceMappingService service;

    private UUID projectId;
    private UUID sessionId;
    private UUID userId;

    @BeforeEach
    void setUp() {
        projectId = UUID.randomUUID();
        sessionId = UUID.randomUUID();
        userId    = UUID.randomUUID();
    }

    @Test
    @DisplayName("ISO27001 — 취약점 없으면 전체 compliant=true")
    void getComplianceReport_ISO27001_취약점없음_전체compliant() {
        given(projectService.isMember(projectId, userId)).willReturn(true);
        given(vulnerabilityQueryService.findOwaspCodesBySessionId(sessionId))
                .willReturn(List.of());

        ComplianceResponse report = service.getComplianceReport(projectId, sessionId, "ISO27001", userId);

        assertThat(report.framework()).isEqualTo("ISO27001");
        assertThat(report.controls()).isNotEmpty();
        assertThat(report.controls()).allMatch(ComplianceResponse.ControlResult::compliant);
        assertThat(report.controls()).allMatch(c -> c.vulnerabilityCount() == 0);
    }

    @Test
    @DisplayName("A01 취약점 1건 → A.9.4.1 컨트롤 compliant=false")
    void getComplianceReport_A01취약점있음_해당컨트롤noncompliant() {
        given(projectService.isMember(projectId, userId)).willReturn(true);
        given(vulnerabilityQueryService.findOwaspCodesBySessionId(sessionId))
                .willReturn(List.of("A01"));

        ComplianceResponse report = service.getComplianceReport(projectId, sessionId, "ISO27001", userId);

        ComplianceResponse.ControlResult a01Control = report.controls().stream()
                .filter(c -> c.controlId().equals("A.9.4.1"))
                .findFirst()
                .orElseThrow();

        assertThat(a01Control.compliant()).isFalse();
        assertThat(a01Control.vulnerabilityCount()).isEqualTo(1);
        assertThat(a01Control.owaspCategory()).contains("A01");
    }

    @Test
    @DisplayName("프로젝트 비멤버 → PROJECT_ACCESS_DENIED 예외")
    void getComplianceReport_비멤버_PROJECT_ACCESS_DENIED() {
        given(projectService.isMember(projectId, userId)).willReturn(false);

        assertThatThrownBy(() ->
                service.getComplianceReport(projectId, sessionId, "ISO27001", userId))
                .isInstanceOf(BusinessException.class)
                .satisfies(e -> assertThat(((BusinessException) e).getErrorCode())
                        .isEqualTo(ErrorCode.PROJECT_ACCESS_DENIED));
    }

    @Test
    @DisplayName("NIST_CSF framework — 취약점 없으면 전체 compliant=true")
    void getComplianceReport_NIST_CSF_취약점없음_전체compliant() {
        given(projectService.isMember(projectId, userId)).willReturn(true);
        given(vulnerabilityQueryService.findOwaspCodesBySessionId(sessionId))
                .willReturn(List.of());

        ComplianceResponse report = service.getComplianceReport(projectId, sessionId, "NIST_CSF", userId);

        assertThat(report.framework()).isEqualTo("NIST_CSF");
        assertThat(report.controls()).allMatch(ComplianceResponse.ControlResult::compliant);
    }

    @Test
    @DisplayName("A01:2021 형식 OWASP 코드도 A01로 정규화되어 매핑된다")
    void getComplianceReport_owaspFullFormat_정규화매핑() {
        given(projectService.isMember(projectId, userId)).willReturn(true);
        // "A01:2021 Broken Access Control" 형식이어도 A01로 추출되어야 한다
        given(vulnerabilityQueryService.findOwaspCodesBySessionId(sessionId))
                .willReturn(List.of("A01:2021 Broken Access Control"));

        ComplianceResponse report = service.getComplianceReport(projectId, sessionId, "ISO27001", userId);

        ComplianceResponse.ControlResult a01Control = report.controls().stream()
                .filter(c -> c.controlId().equals("A.9.4.1"))
                .findFirst()
                .orElseThrow();

        assertThat(a01Control.compliant()).isFalse();
        assertThat(a01Control.vulnerabilityCount()).isEqualTo(1);
    }
}
