package io.secureai.backend.domain.report.service;

import io.secureai.backend.domain.analysis.entity.AnalysisSession;
import io.secureai.backend.domain.analysis.repository.AnalysisSessionRepository;
import io.secureai.backend.domain.auth.service.EmailService;
import io.secureai.backend.domain.project.entity.Project;
import io.secureai.backend.domain.project.repository.ProjectRepository;
import io.secureai.backend.domain.report.dto.ReportRequest;
import io.secureai.backend.domain.report.dto.ReportResponse;
import io.secureai.backend.domain.report.entity.Report;
import io.secureai.backend.domain.report.repository.ReportRepository;
import io.secureai.backend.domain.user.entity.User;
import io.secureai.backend.domain.user.repository.UserRepository;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ReportServiceTest {

    @Mock ReportRepository reportRepository;
    @Mock ProjectRepository projectRepository;
    @Mock AnalysisSessionRepository sessionRepository;
    @Mock UserRepository userRepository;
    @Mock ReportAsyncProcessor asyncProcessor;
    @Mock EmailService emailService;

    @InjectMocks ReportService reportService;

    private UUID userId;
    private UUID projectId;
    private UUID sessionId;
    private UUID reportId;
    private User user;
    private Project project;
    private AnalysisSession session;
    private Report report;

    @BeforeEach
    void setUp() {
        userId    = UUID.randomUUID();
        projectId = UUID.randomUUID();
        sessionId = UUID.randomUUID();
        reportId  = UUID.randomUUID();

        user = User.builder().build();
        ReflectionTestUtils.setField(user, "id", userId);

        project = Project.builder().name("TestProject").sourceType("GITHUB").build();
        ReflectionTestUtils.setField(project, "id", projectId);

        session = AnalysisSession.builder().build();
        ReflectionTestUtils.setField(session, "id", sessionId);

        report = Report.builder()
                .project(project)
                .user(user)
                .format("PDF")
                .build();
        ReflectionTestUtils.setField(report, "id", reportId);
        ReflectionTestUtils.setField(report, "status", "PENDING");
        ReflectionTestUtils.setField(report, "createdAt", OffsetDateTime.now());
        ReflectionTestUtils.setField(report, "expiresAt", OffsetDateTime.now().plusDays(90));
    }

    // -----------------------------------------------------------------------
    // TC-1: requestGeneration — PDF 형식 요청 시 Report PENDING으로 저장
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("requestGeneration — PDF 형식 요청 시 PENDING 상태 Report가 저장된다")
    void requestGeneration_pdf_saves_pending_report() {
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(reportRepository.save(any(Report.class))).thenReturn(report);
        doNothing().when(asyncProcessor).process(any(UUID.class));

        ReportRequest req = new ReportRequest(projectId, null, "PDF");
        ReportResponse response = reportService.requestGeneration(userId, req);

        assertThat(response).isNotNull();
        assertThat(response.status()).isEqualTo("PENDING");
        assertThat(response.format()).isEqualTo("PDF");

        ArgumentCaptor<Report> captor = ArgumentCaptor.forClass(Report.class);
        verify(reportRepository).save(captor.capture());
        assertThat(captor.getValue().getFormat()).isEqualTo("PDF");
        verify(asyncProcessor).process(reportId);
    }

    // -----------------------------------------------------------------------
    // TC-2: requestGeneration — JSON 형식 요청 정상 처리
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("requestGeneration — JSON 형식 요청 시 Report가 저장된다")
    void requestGeneration_json_saves_report() {
        Report jsonReport = Report.builder()
                .project(project).user(user).format("JSON").build();
        ReflectionTestUtils.setField(jsonReport, "id", reportId);
        ReflectionTestUtils.setField(jsonReport, "status", "PENDING");
        ReflectionTestUtils.setField(jsonReport, "createdAt", OffsetDateTime.now());
        ReflectionTestUtils.setField(jsonReport, "expiresAt", OffsetDateTime.now().plusDays(90));

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(reportRepository.save(any(Report.class))).thenReturn(jsonReport);
        doNothing().when(asyncProcessor).process(any(UUID.class));

        ReportRequest req = new ReportRequest(projectId, null, "JSON");
        ReportResponse response = reportService.requestGeneration(userId, req);

        assertThat(response.format()).isEqualTo("JSON");
        assertThat(response.status()).isEqualTo("PENDING");
    }

    // -----------------------------------------------------------------------
    // TC-3: requestGeneration — 지원하지 않는 형식은 INVALID_INPUT 예외
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("requestGeneration — 지원하지 않는 format은 INVALID_INPUT 예외를 발생시킨다")
    void requestGeneration_invalid_format_throws_invalid_input() {
        ReportRequest req = new ReportRequest(projectId, null, "DOCX");

        assertThatThrownBy(() -> reportService.requestGeneration(userId, req))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getErrorCode())
                        .isEqualTo(ErrorCode.INVALID_INPUT));

        verifyNoInteractions(reportRepository, asyncProcessor);
    }

    // -----------------------------------------------------------------------
    // TC-4: requestGeneration — 존재하지 않는 projectId → PROJECT_NOT_FOUND
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("requestGeneration — 존재하지 않는 projectId는 PROJECT_NOT_FOUND 예외를 발생시킨다")
    void requestGeneration_unknown_project_throws_project_not_found() {
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(projectRepository.findById(projectId)).thenReturn(Optional.empty());

        ReportRequest req = new ReportRequest(projectId, null, "PDF");

        assertThatThrownBy(() -> reportService.requestGeneration(userId, req))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getErrorCode())
                        .isEqualTo(ErrorCode.PROJECT_NOT_FOUND));

        verifyNoInteractions(asyncProcessor);
    }

    // -----------------------------------------------------------------------
    // TC-5: getStatus — 다른 사용자의 리포트 조회 시 REPORT_NOT_FOUND
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("getStatus — 소유자가 다른 reportId는 REPORT_NOT_FOUND 예외를 발생시킨다")
    void getStatus_other_user_report_throws_not_found() {
        UUID otherUserId = UUID.randomUUID();
        when(reportRepository.findByIdAndUserId(reportId, otherUserId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> reportService.getStatus(otherUserId, reportId))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getErrorCode())
                        .isEqualTo(ErrorCode.REPORT_NOT_FOUND));
    }

    // -----------------------------------------------------------------------
    // TC-6: getStatus — 정상 조회
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("getStatus — 올바른 userId/reportId는 ReportResponse를 반환한다")
    void getStatus_valid_request_returns_response() {
        when(reportRepository.findByIdAndUserId(reportId, userId)).thenReturn(Optional.of(report));

        ReportResponse response = reportService.getStatus(userId, reportId);

        assertThat(response).isNotNull();
        assertThat(response.id()).isEqualTo(reportId);
        assertThat(response.format()).isEqualTo("PDF");
    }

    // -----------------------------------------------------------------------
    // TC-7: download — 만료된 토큰은 REPORT_NOT_FOUND 예외
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("download — 만료된 다운로드 토큰은 REPORT_NOT_FOUND 예외를 발생시킨다")
    void download_expired_token_throws_not_found() {
        String expiredToken = "expiredtoken12345678901234567890";
        Report completedReport = Report.builder()
                .project(project).user(user).format("PDF").build();
        ReflectionTestUtils.setField(completedReport, "id", reportId);
        ReflectionTestUtils.setField(completedReport, "status", "COMPLETED");
        ReflectionTestUtils.setField(completedReport, "downloadToken", expiredToken);
        ReflectionTestUtils.setField(completedReport, "downloadTokenExpiresAt",
                OffsetDateTime.now().minusHours(1)); // 이미 만료
        ReflectionTestUtils.setField(completedReport, "createdAt", OffsetDateTime.now());
        ReflectionTestUtils.setField(completedReport, "expiresAt", OffsetDateTime.now().plusDays(90));

        when(reportRepository.findByDownloadToken(expiredToken))
                .thenReturn(Optional.of(completedReport));

        assertThatThrownBy(() -> reportService.download(expiredToken))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getErrorCode())
                        .isEqualTo(ErrorCode.REPORT_NOT_FOUND));
    }

    // -----------------------------------------------------------------------
    // TC-8: download — 존재하지 않는 토큰은 REPORT_NOT_FOUND 예외
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("download — 존재하지 않는 토큰은 REPORT_NOT_FOUND 예외를 발생시킨다")
    void download_unknown_token_throws_not_found() {
        String unknownToken = "unknowntoken1234567890123456789012";
        when(reportRepository.findByDownloadToken(unknownToken)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> reportService.download(unknownToken))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getErrorCode())
                        .isEqualTo(ErrorCode.REPORT_NOT_FOUND));
    }

    // -----------------------------------------------------------------------
    // TC-9: requestGeneration — sessionId가 있으면 session을 로드한다
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("requestGeneration — sessionId가 주어지면 AnalysisSession을 조회한다")
    void requestGeneration_with_session_loads_session() {
        Report reportWithSession = Report.builder()
                .project(project).user(user).session(session).format("JSON").build();
        ReflectionTestUtils.setField(reportWithSession, "id", reportId);
        ReflectionTestUtils.setField(reportWithSession, "status", "PENDING");
        ReflectionTestUtils.setField(reportWithSession, "createdAt", OffsetDateTime.now());
        ReflectionTestUtils.setField(reportWithSession, "expiresAt", OffsetDateTime.now().plusDays(90));

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(sessionRepository.findById(sessionId)).thenReturn(Optional.of(session));
        when(reportRepository.save(any(Report.class))).thenReturn(reportWithSession);
        doNothing().when(asyncProcessor).process(any(UUID.class));

        ReportRequest req = new ReportRequest(projectId, sessionId, "JSON");
        ReportResponse response = reportService.requestGeneration(userId, req);

        verify(sessionRepository).findById(sessionId);
        assertThat(response.sessionId()).isEqualTo(sessionId);
    }

    // -----------------------------------------------------------------------
    // TC-10: download — GENERATING 상태 리포트 다운로드 시도 → REPORT_NOT_FOUND
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("download — GENERATING 상태 리포트 다운로드 시도는 REPORT_NOT_FOUND 예외를 발생시킨다")
    void download_not_completed_report_throws_not_found() {
        String token = "activetoken1234567890123456789012";
        Report generatingReport = Report.builder()
                .project(project).user(user).format("PDF").build();
        ReflectionTestUtils.setField(generatingReport, "id", reportId);
        ReflectionTestUtils.setField(generatingReport, "status", "GENERATING");
        ReflectionTestUtils.setField(generatingReport, "downloadToken", token);
        ReflectionTestUtils.setField(generatingReport, "createdAt", OffsetDateTime.now());
        ReflectionTestUtils.setField(generatingReport, "expiresAt", OffsetDateTime.now().plusDays(90));

        when(reportRepository.findByDownloadToken(token)).thenReturn(Optional.of(generatingReport));

        assertThatThrownBy(() -> reportService.download(token))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getErrorCode())
                        .isEqualTo(ErrorCode.REPORT_NOT_FOUND));
    }
}
