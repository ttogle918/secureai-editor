package io.secureai.backend.domain.report.service;

import io.secureai.backend.domain.analysis.entity.Vulnerability;
import io.secureai.backend.domain.analysis.repository.VulnerabilityRepository;
import io.secureai.backend.domain.report.entity.Report;
import io.secureai.backend.domain.report.repository.ReportRepository;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * 리포트 비동기 생성 처리기 — SRP: 비동기 실행 책임만 담당.
 * ReportService가 직접 @Async를 가지면 단위 테스트 시 프록시 문제 발생.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ReportAsyncProcessor {

    private static final String REPORT_DIR_SUFFIX = "/secureai/reports/";
    private static final int TOKEN_VALID_HOURS = 24;

    private final ReportRepository reportRepository;
    private final VulnerabilityRepository vulnerabilityRepository;
    private final PdfReportGenerator pdfReportGenerator;
    private final JsonReportGenerator jsonReportGenerator;

    /**
     * 비동기 리포트 생성 — PENDING → GENERATING → COMPLETED/FAILED.
     */
    @Async("reportExecutor")
    public void process(UUID reportId) {
        // findWithAssociationsById: project·session·user를 JOIN FETCH — 트랜잭션 종료 후에도 속성 접근 가능
        Report report = reportRepository.findWithAssociationsById(reportId)
                .orElseThrow(() -> new BusinessException(ErrorCode.REPORT_NOT_FOUND));

        report.markGenerating();
        reportRepository.save(report);

        try {
            List<Vulnerability> vulns = loadVulnerabilities(report);
            String filePath = buildAndSave(report, vulns);
            String token = UUID.randomUUID().toString().replace("-", "");
            OffsetDateTime tokenExpiry = OffsetDateTime.now().plusHours(TOKEN_VALID_HOURS);

            report.markCompleted(filePath, token, tokenExpiry);
            reportRepository.save(report);
            log.info("[ReportAsyncProcessor] 리포트 생성 완료 reportId={} format={}", reportId, report.getFormat());

        } catch (Exception e) {
            log.error("[ReportAsyncProcessor] 리포트 생성 실패 reportId={}", reportId, e);
            report.markFailed();
            reportRepository.save(report);
        }
    }

    private List<Vulnerability> loadVulnerabilities(Report report) {
        if (report.getSession() != null) {
            return vulnerabilityRepository.findBySessionId(
                    report.getSession().getId(), Pageable.unpaged()).getContent();
        }
        return vulnerabilityRepository.findByProjectId(
                report.getProject().getId(), Pageable.unpaged()).getContent();
    }

    private String buildAndSave(Report report, List<Vulnerability> vulns) throws IOException {
        String reportDir = System.getProperty("java.io.tmpdir") + REPORT_DIR_SUFFIX;
        Path dirPath = Paths.get(reportDir);
        Files.createDirectories(dirPath);

        // 보안: 파일명은 UUID 기반 — 사용자 입력 미사용
        String fileName = report.getId().toString() + "." + report.getFormat().toLowerCase();
        Path filePath = dirPath.resolve(fileName);

        if ("PDF".equals(report.getFormat())) {
            byte[] pdfBytes = pdfReportGenerator.generate(
                    vulns, report.getProject(), report.getSession());
            Files.write(filePath, pdfBytes);
        } else {
            String json = jsonReportGenerator.generate(
                    vulns, report.getProject(), report.getSession());
            Files.write(filePath, json.getBytes(StandardCharsets.UTF_8));
        }

        return filePath.toString();
    }
}
