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
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.OffsetDateTime;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReportService {

    private final ReportRepository reportRepository;
    private final ProjectRepository projectRepository;
    private final AnalysisSessionRepository sessionRepository;
    private final UserRepository userRepository;
    private final ReportAsyncProcessor asyncProcessor;
    private final EmailService emailService;

    @Value("${secureai.frontend.url:http://localhost:3000}")
    private String frontendUrl;

    /**
     * 리포트 생성 요청 — Report 레코드를 PENDING 상태로 저장 후 비동기 생성 트리거.
     */
    @Transactional
    public ReportResponse requestGeneration(UUID userId, ReportRequest req) {
        validateFormat(req.format());

        User user = findUser(userId);
        Project project = findProject(req.projectId());
        AnalysisSession session = resolveSession(req.sessionId());

        Report report = Report.builder()
                .project(project)
                .session(session)
                .user(user)
                .format(req.format().toUpperCase())
                .build();
        Report saved = reportRepository.save(report);

        // 커밋 완료 후 async 트리거 — 커밋 전 실행 시 findById가 "찾을 수 없음" 실패.
        // 트랜잭션 동기화가 없는 경우(트랜잭션 밖 호출·단위 테스트)에는 즉시 실행해 리포트 유실 방지.
        UUID reportId = saved.getId();
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    asyncProcessor.process(reportId);
                }
            });
        } else {
            asyncProcessor.process(reportId);
        }

        return ReportResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public ReportResponse getStatus(UUID userId, UUID reportId) {
        Report report = reportRepository.findByIdAndUserId(reportId, userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.REPORT_NOT_FOUND));
        return ReportResponse.from(report);
    }

    @Transactional(readOnly = true)
    public Page<ReportResponse> listReports(UUID userId, UUID projectId, UUID sessionId, Pageable pageable) {
        Page<Report> reports = (sessionId != null)
                ? reportRepository.findByProjectIdAndSessionId(projectId, sessionId, pageable)
                : reportRepository.findByProjectId(projectId, pageable);
        return reports.map(ReportResponse::from);
    }

    /**
     * 토큰으로 파일 다운로드 — 토큰 만료 여부 검증 후 Resource 반환.
     * 보안: 토큰 자체가 인증 수단이므로 별도 사용자 인증 불필요.
     * 단, 토큰 만료 시간 반드시 검사.
     */
    @Transactional(readOnly = true)
    public DownloadResult download(String downloadToken) {
        Report report = reportRepository.findByDownloadToken(downloadToken)
                .orElseThrow(() -> new BusinessException(ErrorCode.REPORT_NOT_FOUND));

        if (!"COMPLETED".equals(report.getStatus())) {
            throw new BusinessException(ErrorCode.REPORT_NOT_FOUND, "리포트가 아직 생성되지 않았습니다.");
        }
        if (report.getDownloadTokenExpiresAt() == null
                || OffsetDateTime.now().isAfter(report.getDownloadTokenExpiresAt())) {
            throw new BusinessException(ErrorCode.REPORT_NOT_FOUND, "다운로드 토큰이 만료되었습니다.");
        }

        return readFileAsResource(report);
    }

    /**
     * 리포트 다운로드 링크 + PDF 첨부 파일을 사용자 이메일로 전송.
     */
    @Transactional(readOnly = true)
    public void sendEmail(UUID userId, UUID reportId) {
        Report report = reportRepository.findByIdAndUserId(reportId, userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.REPORT_NOT_FOUND));

        if (!"COMPLETED".equals(report.getStatus())) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "완료된 리포트만 이메일로 전송할 수 있습니다.");
        }

        User user = findUser(userId);
        String downloadLink = frontendUrl + "/api/v1/reports/download/" + report.getDownloadToken();
        String fileName = "report-" + report.getId() + "." + report.getFormat().toLowerCase();

        byte[] pdfBytes = null;
        if ("PDF".equals(report.getFormat())) {
            try {
                Path filePath = Paths.get(report.getFilePath()).toAbsolutePath().normalize();
                if (filePath.startsWith(REPORT_BASE_DIR)) {
                    pdfBytes = Files.readAllBytes(filePath);
                }
            } catch (IOException e) {
                log.warn("[ReportService] PDF 첨부 실패 — 링크만 전송 reportId={}", reportId);
            }
        }

        emailService.sendReportEmail(user.getEmail(), fileName, downloadLink, pdfBytes);
    }

    private void validateFormat(String format) {
        if (format == null) throw new BusinessException(ErrorCode.INVALID_INPUT, "형식을 입력하세요.");
        switch (format.toUpperCase()) {
            case "PDF", "JSON", "HTML", "MD" -> { /* valid */ }
            default -> throw new BusinessException(
                    ErrorCode.INVALID_INPUT, "지원하지 않는 형식입니다. PDF, JSON, HTML, MD 중 하나를 입력하세요.");
        }
    }

    private User findUser(UUID userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
    }

    private Project findProject(UUID projectId) {
        return projectRepository.findById(projectId)
                .orElseThrow(() -> new BusinessException(ErrorCode.PROJECT_NOT_FOUND));
    }

    private AnalysisSession resolveSession(UUID sessionId) {
        if (sessionId == null) return null;
        return sessionRepository.findById(sessionId)
                .orElseThrow(() -> new BusinessException(ErrorCode.SESSION_NOT_FOUND));
    }

    private static final Path REPORT_BASE_DIR =
            Paths.get(System.getProperty("java.io.tmpdir"), "secureai", "reports").toAbsolutePath().normalize();

    private DownloadResult readFileAsResource(Report report) {
        try {
            Path filePath = Paths.get(report.getFilePath()).toAbsolutePath().normalize();
            // DB에 저장된 경로라도 허용된 디렉토리 하위인지 검증 (Path Traversal 방어)
            if (!filePath.startsWith(REPORT_BASE_DIR)) {
                log.warn("[ReportService] 허용되지 않은 경로 접근 시도 reportId={}", report.getId());
                throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR, "파일을 읽을 수 없습니다.");
            }
            byte[] content = Files.readAllBytes(filePath);
            String contentType = switch (report.getFormat()) {
                case "PDF"  -> "application/pdf";
                case "HTML" -> "text/html; charset=UTF-8";
                case "MD"   -> "text/markdown; charset=UTF-8";
                default     -> "application/json";
            };
            String fileName = "report-" + report.getId() + "." + report.getFormat().toLowerCase();
            return new DownloadResult(new ByteArrayResource(content), contentType, fileName);
        } catch (IOException e) {
            log.error("[ReportService] 파일 읽기 실패 reportId={}", report.getId(), e);
            throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR, "파일을 읽을 수 없습니다.");
        }
    }

    public record DownloadResult(Resource resource, String contentType, String fileName) {}
}
