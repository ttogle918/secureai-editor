package io.secureai.backend.domain.report.service;

import io.secureai.backend.domain.analysis.entity.Vulnerability;
import io.secureai.backend.domain.analysis.repository.VulnerabilityRepository;
import io.secureai.backend.domain.report.entity.DocType;
import io.secureai.backend.domain.report.entity.SecurityDocRequest;
import io.secureai.backend.domain.report.entity.ComplianceFramework;
import io.secureai.backend.domain.report.entity.ComplianceControl;
import io.secureai.backend.domain.report.repository.SecurityDocRequestRepository;
import io.secureai.backend.domain.report.repository.ComplianceFrameworkRepository;
import io.secureai.backend.domain.report.repository.ComplianceControlRepository;
import io.secureai.backend.domain.report.service.RoiCalculationService.RoiResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;

import java.io.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

/**
 * 보안 문서 비동기 생성 처리기 — SRP: 비동기 실행 및 PDF 변환 책임만 담당.
 * SecurityDocService가 직접 @Async를 가지면 프록시 문제 발생하므로 분리.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SecurityDocAsyncProcessor {

    private static final Path SEC_DOC_BASE_DIR =
            Paths.get(System.getProperty("java.io.tmpdir"), "secureai", "security-docs")
                    .toAbsolutePath().normalize();
    private static final int TOKEN_VALID_HOURS = 24;
    private static final int TOKEN_BYTES = 32;
    private static final DateTimeFormatter DISPLAY_FORMATTER =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final SecurityDocRequestRepository securityDocRequestRepository;
    private final VulnerabilityRepository vulnerabilityRepository;
    private final TemplateEngine templateEngine;
    private final RoiCalculationService roiCalculationService;
    private final ComplianceFrameworkRepository frameworkRepo;
    private final ComplianceControlRepository controlRepo;
    private final DocxTemplateFiller docxTemplateFiller;

    @Async("secDocExecutor")
    public void process(UUID requestId) {
        SecurityDocRequest req = securityDocRequestRepository.findWithProjectById(requestId)
                .orElse(null);
        if (req == null) {
            log.warn("[SecDocProcessor] 요청을 찾을 수 없음 requestId={}", requestId);
            return;
        }

        req.markProcessing();
        securityDocRequestRepository.save(req);

        try {
            List<Vulnerability> vulns = loadVulnerabilities(req);
            String filePath = buildAndSavePdf(req, vulns);
            String token = generateSecureToken();
            OffsetDateTime tokenExpiry = OffsetDateTime.now().plusHours(TOKEN_VALID_HOURS);

            req.markCompleted(filePath, token, tokenExpiry);
            securityDocRequestRepository.save(req);
            log.info("[SecDocProcessor] 보안 문서 생성 완료 requestId={} docType={}", requestId, req.getDocType());

        } catch (Exception e) {
            log.error("[SecDocProcessor] 보안 문서 생성 실패 requestId={} docType={}", requestId, req.getDocType(), e);
            req.markFailed(sanitizeErrorMessage(e.getMessage()));
            securityDocRequestRepository.save(req);
        }
    }

    @Async("secDocExecutor")
    public CompletableFuture<String> processRoiReport(UUID sessionId, double hourlyRate) {
        log.info("[SecDocProcessor] ROI 리포트 생성 시작 sessionId={}", sessionId);
        try {
            RoiResult roi = roiCalculationService.calculateRoi(sessionId, hourlyRate);
            String html = renderRoiTemplate(roi);
            Path dirPath = SEC_DOC_BASE_DIR;
            Files.createDirectories(dirPath);

            String fileName = "roi-" + sessionId + "-" + UUID.randomUUID() + ".pdf";
            Path filePath = dirPath.resolve(fileName);

            try (OutputStream os = new FileOutputStream(filePath.toFile())) {
                PdfRendererBuilder builder = new PdfRendererBuilder();
                builder.withHtmlContent(html, null);
                builder.toStream(os);
                builder.run();
            }

            log.info("[SecDocProcessor] ROI 리포트 생성 완료 sessionId={} path={}",
                    sessionId, filePath.getFileName());
            return CompletableFuture.completedFuture(filePath.toString());

        } catch (Exception e) {
            log.error("[SecDocProcessor] ROI 리포트 생성 실패 sessionId={}", sessionId, e);
            return CompletableFuture.failedFuture(e);
        }
    }

    private String renderRoiTemplate(RoiResult roi) {
        Context ctx = new Context();
        ctx.setVariable("projectName",    roi.projectName());
        ctx.setVariable("sessionDate",    LocalDateTime.now().format(DISPLAY_FORMATTER));
        ctx.setVariable("criticalCount",  roi.criticalCount());
        ctx.setVariable("highCount",      roi.highCount());
        ctx.setVariable("mediumCount",    roi.mediumCount());
        ctx.setVariable("lowCount",       roi.lowCount());
        ctx.setVariable("totalVulnCount", roi.totalVulnCount());
        ctx.setVariable("savedHours",     roi.savedHours());
        ctx.setVariable("savedCost",      roi.savedCost());
        ctx.setVariable("hourlyRate",     roi.hourlyRate());
        return templateEngine.process("roi-report", ctx);
    }

    private List<Vulnerability> loadVulnerabilities(SecurityDocRequest req) {
        return vulnerabilityRepository.findByProjectId(
                req.getProject().getId(), Pageable.unpaged()).getContent();
    }

    private ComplianceFramework resolveFramework(SecurityDocRequest req) {
        if (req.getFrameworkVersion() != null && !req.getFrameworkVersion().isEmpty()) {
            return frameworkRepo.findByDocTypeAndVersion(req.getDocType(), req.getFrameworkVersion())
                    .orElseGet(() -> frameworkRepo.findByDocTypeAndStatusOrderByCreatedAtDesc(req.getDocType(), "ACTIVE").get(0));
        }
        List<ComplianceFramework> list = frameworkRepo.findByDocTypeAndStatusOrderByCreatedAtDesc(req.getDocType(), "ACTIVE");
        if (list.isEmpty()) {
            throw new RuntimeException("해당 문서 타입의 프레임워크가 DB에 없습니다: " + req.getDocType());
        }
        return list.get(0);
    }

    private String buildAndSavePdf(SecurityDocRequest req, List<Vulnerability> vulns) throws IOException {
        ComplianceFramework framework = resolveFramework(req);
        
        // TODO: 만약 DOCX 양식을 바로 채워야한다면 docxTemplateFiller를 사용하도록 확장 가능.
        // 현재는 기존대로 HTML->PDF 렌더링에 동적 데이터를 주입함.

        String html = renderTemplate(req, framework, vulns);
        Path dirPath = SEC_DOC_BASE_DIR;
        Files.createDirectories(dirPath);

        String fileName = req.getId().toString() + ".pdf";
        Path filePath = dirPath.resolve(fileName);

        try (OutputStream os = new FileOutputStream(filePath.toFile())) {
            PdfRendererBuilder builder = new PdfRendererBuilder();
            builder.withHtmlContent(html, null);
            builder.toStream(os);
            builder.run();
        }
        return filePath.toString();
    }

    private String renderTemplate(SecurityDocRequest req, ComplianceFramework fw, List<Vulnerability> vulns) {
        Context ctx = buildTemplateContext(req, fw, vulns);
        String templateName = resolveTemplateName(req.getDocType());
        return templateEngine.process(templateName, ctx);
    }

    private String resolveTemplateName(DocType docType) {
        return switch (docType) {
            case CISO    -> "security/ciso-report";
            case HANAFOS -> "security/hanafos-checklist";
            case ISMS    -> "security/isms-p-evidence";
        };
    }

    private Context buildTemplateContext(SecurityDocRequest req, ComplianceFramework fw, List<Vulnerability> vulns) {
        Context ctx = new Context();
        ctx.setVariable("projectName", req.getProject().getName());
        ctx.setVariable("generatedAt", LocalDateTime.now().format(DISPLAY_FORMATTER));
        ctx.setVariable("frameworkName", fw.getName());
        ctx.setVariable("frameworkVersion", fw.getVersion());

        List<ComplianceControl> controls = controlRepo.findByFrameworkIdOrderByControlIdAsc(fw.getId());

        switch (req.getDocType()) {
            case CISO    -> populateCisoContext(ctx, vulns);
            case HANAFOS -> populateHanafosContext(ctx, controls, vulns);
            case ISMS    -> populateIsmsContext(ctx, controls, vulns);
        }
        return ctx;
    }

    private void populateCisoContext(Context ctx, List<Vulnerability> vulns) {
        ctx.setVariable("totalCount", vulns.size());
        ctx.setVariable("criticalCount", countBySeverity(vulns, "CRITICAL"));
        ctx.setVariable("highCount",     countBySeverity(vulns, "HIGH"));
        ctx.setVariable("mediumCount",   countBySeverity(vulns, "MEDIUM"));
        ctx.setVariable("lowCount",      countBySeverity(vulns, "LOW"));
        ctx.setVariable("allVulns",      vulns);

        List<Vulnerability> criticalHigh = vulns.stream()
                .filter(v -> "CRITICAL".equals(v.getSeverity()) || "HIGH".equals(v.getSeverity()))
                .collect(Collectors.toList());
        ctx.setVariable("criticalHighVulns", criticalHigh);
    }

    private void populateHanafosContext(Context ctx, List<ComplianceControl> controls, List<Vulnerability> vulns) {
        List<HanafosChecklistItem> items = buildHanafosChecklist(controls, vulns);
        long passCount = items.stream().filter(i -> "PASS".equals(i.complianceStatus())).count();
        long failCount = items.stream().filter(i -> "FAIL".equals(i.complianceStatus())).count();
        long naCount   = items.stream().filter(i -> "NA".equals(i.complianceStatus())).count();

        ctx.setVariable("checklistItems", items);
        ctx.setVariable("passCount", passCount);
        ctx.setVariable("failCount", failCount);
        ctx.setVariable("naCount",   naCount);
    }

    private void populateIsmsContext(Context ctx, List<ComplianceControl> controls, List<Vulnerability> vulns) {
        List<IsmsControlItem> items = buildIsmsControlItems(controls, vulns);
        long implementedCount = items.stream().filter(i -> "IMPLEMENTED".equals(i.implementationStatus())).count();
        long partialCount     = items.stream().filter(i -> "PARTIAL".equals(i.implementationStatus())).count();
        long noneCount        = items.stream().filter(i -> "NOT_IMPLEMENTED".equals(i.implementationStatus())).count();

        ctx.setVariable("controlItems",       items);
        ctx.setVariable("implementedCount",   implementedCount);
        ctx.setVariable("partialCount",       partialCount);
        ctx.setVariable("noneCount",          noneCount);
    }

    private List<HanafosChecklistItem> buildHanafosChecklist(List<ComplianceControl> controls, List<Vulnerability> vulns) {
        Set<String> vulnTypes = vulns.stream().map(Vulnerability::getVulnType).collect(Collectors.toSet());
        List<HanafosChecklistItem> items = new ArrayList<>();
        for (ComplianceControl def : controls) {
            List<String> related = def.getRelatedVulnTypes() != null ? def.getRelatedVulnTypes() : List.of();
            boolean detected = related.stream().anyMatch(vulnTypes::contains);
            String status = related.isEmpty() ? "NA" : (detected ? "FAIL" : "PASS");
            String relatedVulns = buildRelatedVulnsText(vulns, related);
            items.add(new HanafosChecklistItem(def.getControlId(), def.getCategory(), def.getName(), relatedVulns, status, ""));
        }
        return items;
    }

    private String buildRelatedVulnsText(List<Vulnerability> vulns, List<String> relatedTypes) {
        return vulns.stream()
                .filter(v -> relatedTypes.contains(v.getVulnType()))
                .map(v -> v.getVulnType() + "(" + v.getSeverity() + ")")
                .distinct()
                .collect(Collectors.joining(", "));
    }

    private List<IsmsControlItem> buildIsmsControlItems(List<ComplianceControl> controls, List<Vulnerability> vulns) {
        Set<String> vulnTypes = vulns.stream().map(Vulnerability::getVulnType).collect(Collectors.toSet());
        List<IsmsControlItem> items = new ArrayList<>();
        for (ComplianceControl def : controls) {
            String status;
            String evidence;
            List<String> related = def.getRelatedVulnTypes() != null ? def.getRelatedVulnTypes() : List.of();
            
            if (related.isEmpty()) {
                status = "NA";
                evidence = "해당 없음";
            } else {
                List<Vulnerability> matched = vulns.stream()
                        .filter(v -> related.contains(v.getVulnType()))
                        .collect(Collectors.toList());
                if (matched.isEmpty()) {
                    status = "IMPLEMENTED";
                    evidence = "관련 취약점 미발견";
                } else {
                    long fixedCount = matched.stream().filter(v -> "fixed".equals(v.getStatus())).count();
                    status = (fixedCount == matched.size()) ? "IMPLEMENTED" : (fixedCount > 0) ? "PARTIAL" : "NOT_IMPLEMENTED";
                    evidence = buildRelatedVulnsText(vulns, related);
                }
            }
            items.add(new IsmsControlItem(def.getControlId(), def.getName(), status, evidence, ""));
        }
        return items;
    }

    private long countBySeverity(List<Vulnerability> vulns, String severity) {
        return vulns.stream().filter(v -> severity.equals(v.getSeverity())).count();
    }

    private String generateSecureToken() {
        byte[] bytes = new byte[TOKEN_BYTES];
        new SecureRandom().nextBytes(bytes);
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }

    private String sanitizeErrorMessage(String message) {
        if (message == null) return "PDF 생성 중 오류가 발생했습니다.";
        if (message.contains("/") || message.contains("\\")) {
            return "PDF 생성 중 오류가 발생했습니다.";
        }
        return message.length() > 200 ? message.substring(0, 200) : message;
    }

    record HanafosChecklistItem(String itemNo, String category, String itemName, String relatedVulns, String complianceStatus, String note) {}
    record IsmsControlItem(String controlId, String controlName, String implementationStatus, String evidence, String auditorNote) {}
}
