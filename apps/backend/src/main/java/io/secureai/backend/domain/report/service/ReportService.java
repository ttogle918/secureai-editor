package io.secureai.backend.domain.report.service;

import io.secureai.backend.domain.analysis.entity.AnalysisSession;
import io.secureai.backend.domain.analysis.repository.AnalysisSessionRepository;
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
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

        asyncProcessor.process(saved.getId());
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

    private void validateFormat(String format) {
        if (!"PDF".equalsIgnoreCase(format) && !"JSON".equalsIgnoreCase(format)) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "지원하지 않는 형식입니다. PDF 또는 JSON을 입력하세요.");
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
            String contentType = "PDF".equals(report.getFormat())
                    ? "application/pdf"
                    : "application/json";
            String fileName = "report-" + report.getId() + "." + report.getFormat().toLowerCase();
            return new DownloadResult(new ByteArrayResource(content), contentType, fileName);
        } catch (IOException e) {
            log.error("[ReportService] 파일 읽기 실패 reportId={}", report.getId(), e);
            throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR, "파일을 읽을 수 없습니다.");
        }
    }

    public record DownloadResult(Resource resource, String contentType, String fileName) {}
}
