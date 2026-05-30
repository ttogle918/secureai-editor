package io.secureai.backend.domain.report.controller;

import io.secureai.backend.domain.report.dto.ReportRequest;
import io.secureai.backend.domain.report.dto.ReportResponse;
import io.secureai.backend.domain.report.service.ReportService;
import io.secureai.backend.domain.report.service.RoiCalculationService;
import io.secureai.backend.domain.report.service.RoiCalculationService.RoiResult;
import io.secureai.backend.domain.report.service.SecurityDocAsyncProcessor;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ReportControllerTest {

    @Mock ReportService reportService;
    @Mock RoiCalculationService roiCalculationService;
    @Mock SecurityDocAsyncProcessor securityDocAsyncProcessor;

    private ReportController controller;
    private final UUID userId = UUID.randomUUID();
    private final UUID projectId = UUID.randomUUID();
    private final UUID sessionId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        controller = new ReportController(reportService, roiCalculationService, securityDocAsyncProcessor);
    }

    @Test
    @DisplayName("requestReport — 비동기 생성 요청을 202 ACCEPTED 로 응답한다")
    void requestReport_returns202() {
        ReportRequest req = mock(ReportRequest.class);
        ReportResponse pending = mock(ReportResponse.class);
        when(reportService.requestGeneration(userId, req)).thenReturn(pending);

        var response = controller.requestReport(userId, req);

        assertThat(response.getStatusCode().value()).isEqualTo(202);
        assertThat(response.getBody().getData()).isSameAs(pending);
    }

    @Test
    @DisplayName("getStatus — 생성 상태를 200 으로 반환한다")
    void getStatus_delegates() {
        UUID reportId = UUID.randomUUID();
        ReportResponse status = mock(ReportResponse.class);
        when(reportService.getStatus(userId, reportId)).thenReturn(status);

        var response = controller.getStatus(userId, reportId);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().getData()).isSameAs(status);
    }

    @Test
    @DisplayName("sendEmail — 본인 이메일 전송을 위임하고 200 을 반환한다")
    void sendEmail_delegates() {
        UUID reportId = UUID.randomUUID();

        var response = controller.sendEmail(userId, reportId);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        verify(reportService).sendEmail(userId, reportId);
    }

    @Test
    @DisplayName("listReports — projectId/sessionId/pageable 로 위임하고 200 을 반환한다")
    void listReports_delegates() {
        Pageable pageable = PageRequest.of(0, 20);
        @SuppressWarnings("unchecked")
        Page<ReportResponse> page = mock(Page.class);
        when(reportService.listReports(userId, projectId, sessionId, pageable)).thenReturn(page);

        var response = controller.listReports(userId, projectId, sessionId, pageable);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().getData()).isSameAs(page);
    }

    @Test
    @DisplayName("getRoiResult — 유효한 hourlyRate 로 ROI 를 계산해 200 을 반환한다")
    void getRoiResult_valid() {
        RoiResult result = mock(RoiResult.class);
        when(roiCalculationService.calculateRoi(sessionId, 50.0)).thenReturn(result);

        var response = controller.getRoiResult(userId, projectId, sessionId, 50.0);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().getData()).isSameAs(result);
    }

    @Test
    @DisplayName("getRoiResult — 음수 hourlyRate 는 INVALID_INPUT 으로 거부한다")
    void getRoiResult_negativeRate_throws() {
        assertThatThrownBy(() -> controller.getRoiResult(userId, projectId, sessionId, -1.0))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getErrorCode())
                        .isEqualTo(ErrorCode.INVALID_INPUT));
        verifyNoInteractions(roiCalculationService);
    }

    @Test
    @DisplayName("downloadRoiPdf — 음수 hourlyRate 는 PDF 생성 전에 INVALID_INPUT 으로 거부한다")
    void downloadRoiPdf_negativeRate_throws() {
        assertThatThrownBy(() -> controller.downloadRoiPdf(userId, projectId, sessionId, -5.0))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getErrorCode())
                        .isEqualTo(ErrorCode.INVALID_INPUT));
        verifyNoInteractions(securityDocAsyncProcessor);
    }
}
