package io.secureai.backend.domain.report.service;

import io.secureai.backend.domain.analysis.entity.Vulnerability;
import io.secureai.backend.domain.analysis.repository.VulnerabilityRepository;
import io.secureai.backend.domain.report.entity.DocType;
import io.secureai.backend.domain.report.entity.SecurityDocRequest;
import io.secureai.backend.domain.report.repository.SecurityDocRequestRepository;
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

    @Async("secDocExecutor")
    public void process(UUID requestId) {
        SecurityDocRequest req = securityDocRequestRepository.findById(requestId)
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
            // 보안: 토큰값 로그 출력 금지
            log.info("[SecDocProcessor] 보안 문서 생성 완료 requestId={} docType={}", requestId, req.getDocType());

        } catch (Exception e) {
            log.error("[SecDocProcessor] 보안 문서 생성 실패 requestId={} docType={}", requestId, req.getDocType(), e);
            req.markFailed(sanitizeErrorMessage(e.getMessage()));
            securityDocRequestRepository.save(req);
        }
    }

    private List<Vulnerability> loadVulnerabilities(SecurityDocRequest req) {
        return vulnerabilityRepository.findByProjectId(
                req.getProject().getId(), Pageable.unpaged()).getContent();
    }

    private String buildAndSavePdf(SecurityDocRequest req, List<Vulnerability> vulns) throws IOException {
        String html = renderTemplate(req, vulns);
        Path dirPath = SEC_DOC_BASE_DIR;
        Files.createDirectories(dirPath);

        // 보안: 파일명은 UUID 기반 — 사용자 입력 미사용
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

    private String renderTemplate(SecurityDocRequest req, List<Vulnerability> vulns) {
        Context ctx = buildTemplateContext(req, vulns);
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

    private Context buildTemplateContext(SecurityDocRequest req, List<Vulnerability> vulns) {
        Context ctx = new Context();
        String projectName = req.getProject().getName();
        String generatedAt = LocalDateTime.now().format(DISPLAY_FORMATTER);

        ctx.setVariable("projectName", projectName);
        ctx.setVariable("generatedAt", generatedAt);

        switch (req.getDocType()) {
            case CISO    -> populateCisoContext(ctx, vulns);
            case HANAFOS -> populateHanafosContext(ctx, vulns);
            case ISMS    -> populateIsmsContext(ctx, vulns);
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

    private void populateHanafosContext(Context ctx, List<Vulnerability> vulns) {
        List<HanafosChecklistItem> items = buildHanafosChecklist(vulns);
        long passCount = items.stream().filter(i -> "PASS".equals(i.complianceStatus())).count();
        long failCount = items.stream().filter(i -> "FAIL".equals(i.complianceStatus())).count();
        long naCount   = items.stream().filter(i -> "NA".equals(i.complianceStatus())).count();

        ctx.setVariable("checklistItems", items);
        ctx.setVariable("passCount", passCount);
        ctx.setVariable("failCount", failCount);
        ctx.setVariable("naCount",   naCount);
    }

    private void populateIsmsContext(Context ctx, List<Vulnerability> vulns) {
        List<IsmsControlItem> items = buildIsmsControlItems(vulns);
        long implementedCount = items.stream().filter(i -> "IMPLEMENTED".equals(i.implementationStatus())).count();
        long partialCount     = items.stream().filter(i -> "PARTIAL".equals(i.implementationStatus())).count();
        long noneCount        = items.stream().filter(i -> "NOT_IMPLEMENTED".equals(i.implementationStatus())).count();

        ctx.setVariable("controlItems",       items);
        ctx.setVariable("implementedCount",   implementedCount);
        ctx.setVariable("partialCount",       partialCount);
        ctx.setVariable("noneCount",          noneCount);
    }

    // ── 행안부 43개 항목 체크리스트 매핑 ─────────────────────────────────────

    /**
     * 취약점 목록을 기반으로 행안부 43개 항목 준수 여부를 판정한다.
     * vulnType이 매핑되는 항목은 발견된 취약점 건수를 기준으로 PASS/FAIL을 결정한다.
     */
    private List<HanafosChecklistItem> buildHanafosChecklist(List<Vulnerability> vulns) {
        Set<String> vulnTypes = vulns.stream()
                .map(Vulnerability::getVulnType)
                .collect(Collectors.toSet());

        List<HanafosChecklistItem> items = new ArrayList<>();
        for (HanafosItemDefinition def : HANAFOS_DEFINITIONS) {
            boolean detected = def.relatedVulnTypes().stream().anyMatch(vulnTypes::contains);
            String status = def.relatedVulnTypes().isEmpty() ? "NA"
                    : (detected ? "FAIL" : "PASS");
            String relatedVulns = buildRelatedVulnsText(vulns, def.relatedVulnTypes());
            items.add(new HanafosChecklistItem(
                    def.itemNo(), def.category(), def.itemName(), relatedVulns, status, ""));
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

    // ── ISMS-P 통제항목 매핑 ─────────────────────────────────────────────────

    private List<IsmsControlItem> buildIsmsControlItems(List<Vulnerability> vulns) {
        Set<String> vulnTypes = vulns.stream()
                .map(Vulnerability::getVulnType)
                .collect(Collectors.toSet());

        List<IsmsControlItem> items = new ArrayList<>();
        for (IsmsControlDefinition def : ISMS_DEFINITIONS) {
            String status;
            String evidence;
            if (def.relatedVulnTypes().isEmpty()) {
                status = "NA";
                evidence = "해당 없음";
            } else {
                List<Vulnerability> matched = vulns.stream()
                        .filter(v -> def.relatedVulnTypes().contains(v.getVulnType()))
                        .collect(Collectors.toList());
                if (matched.isEmpty()) {
                    status = "IMPLEMENTED";
                    evidence = "관련 취약점 미발견";
                } else {
                    long fixedCount = matched.stream()
                            .filter(v -> "fixed".equals(v.getStatus())).count();
                    status = (fixedCount == matched.size()) ? "IMPLEMENTED"
                            : (fixedCount > 0) ? "PARTIAL" : "NOT_IMPLEMENTED";
                    evidence = buildRelatedVulnsText(vulns, def.relatedVulnTypes());
                }
            }
            items.add(new IsmsControlItem(def.controlId(), def.controlName(), status, evidence, ""));
        }
        return items;
    }

    // ── 보조 메서드 ──────────────────────────────────────────────────────────

    private long countBySeverity(List<Vulnerability> vulns, String severity) {
        return vulns.stream().filter(v -> severity.equals(v.getSeverity())).count();
    }

    /** SecureRandom 32바이트 → HEX 64자 다운로드 토큰 생성. */
    private String generateSecureToken() {
        byte[] bytes = new byte[TOKEN_BYTES];
        new SecureRandom().nextBytes(bytes);
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }

    /** 사용자에게 노출되는 에러 메시지에서 내부 경로/스택 트레이스 제거. */
    private String sanitizeErrorMessage(String message) {
        if (message == null) return "PDF 생성 중 오류가 발생했습니다.";
        // 경로 정보가 포함된 경우 일반 메시지로 교체
        if (message.contains("/") || message.contains("\\")) {
            return "PDF 생성 중 오류가 발생했습니다.";
        }
        return message.length() > 200 ? message.substring(0, 200) : message;
    }

    // ── 내부 레코드 정의 ─────────────────────────────────────────────────────

    record HanafosChecklistItem(
            String itemNo,
            String category,
            String itemName,
            String relatedVulns,
            String complianceStatus,
            String note
    ) {}

    record HanafosItemDefinition(
            String itemNo,
            String category,
            String itemName,
            List<String> relatedVulnTypes
    ) {}

    record IsmsControlItem(
            String controlId,
            String controlName,
            String implementationStatus,
            String evidence,
            String auditorNote
    ) {}

    record IsmsControlDefinition(
            String controlId,
            String controlName,
            List<String> relatedVulnTypes
    ) {}

    // ── 행안부 43개 항목 정의 (SW개발보안 가이드 기준) ──────────────────────

    private static final List<HanafosItemDefinition> HANAFOS_DEFINITIONS = List.of(
        new HanafosItemDefinition("1",  "입력 데이터 검증 및 표현", "SQL 삽입",             List.of("SQL_INJECTION")),
        new HanafosItemDefinition("2",  "입력 데이터 검증 및 표현", "코드 삽입",             List.of("CODE_INJECTION")),
        new HanafosItemDefinition("3",  "입력 데이터 검증 및 표현", "경로 조작 및 자원 삽입", List.of("PATH_TRAVERSAL")),
        new HanafosItemDefinition("4",  "입력 데이터 검증 및 표현", "XSS",                  List.of("XSS", "STORED_XSS", "REFLECTED_XSS")),
        new HanafosItemDefinition("5",  "입력 데이터 검증 및 표현", "운영체제 명령어 삽입",   List.of("OS_COMMAND_INJECTION")),
        new HanafosItemDefinition("6",  "입력 데이터 검증 및 표현", "위험한 형식 파일 업로드", List.of("FILE_UPLOAD")),
        new HanafosItemDefinition("7",  "입력 데이터 검증 및 표현", "신뢰되지 않는 URL 주소로 자동접속 연결", List.of("OPEN_REDIRECT")),
        new HanafosItemDefinition("8",  "입력 데이터 검증 및 표현", "XQuery 삽입",           List.of("XQUERY_INJECTION")),
        new HanafosItemDefinition("9",  "입력 데이터 검증 및 표현", "XPath 삽입",            List.of("XPATH_INJECTION")),
        new HanafosItemDefinition("10", "입력 데이터 검증 및 표현", "LDAP 삽입",             List.of("LDAP_INJECTION")),
        new HanafosItemDefinition("11", "입력 데이터 검증 및 표현", "크로스사이트 요청 위조",  List.of("CSRF")),
        new HanafosItemDefinition("12", "입력 데이터 검증 및 표현", "HTTP 응답 분할",         List.of("HTTP_RESPONSE_SPLITTING")),
        new HanafosItemDefinition("13", "입력 데이터 검증 및 표현", "정수형 오버플로우",       List.of("INTEGER_OVERFLOW")),
        new HanafosItemDefinition("14", "입력 데이터 검증 및 표현", "보안기능 결정에 사용되는 부적절한 입력값", List.of()),
        new HanafosItemDefinition("15", "입력 데이터 검증 및 표현", "메모리 버퍼 오버플로우",  List.of("BUFFER_OVERFLOW")),
        new HanafosItemDefinition("16", "입력 데이터 검증 및 표현", "포맷 스트링 삽입",        List.of("FORMAT_STRING")),
        new HanafosItemDefinition("17", "보안 기능",               "적절한 인증 없는 중요기능 허용", List.of("BROKEN_AUTH")),
        new HanafosItemDefinition("18", "보안 기능",               "부적절한 인가",           List.of("BROKEN_ACCESS_CONTROL")),
        new HanafosItemDefinition("19", "보안 기능",               "중요한 자원에 대한 잘못된 권한 설정", List.of()),
        new HanafosItemDefinition("20", "보안 기능",               "취약한 암호화 알고리즘 사용", List.of("WEAK_CRYPTO")),
        new HanafosItemDefinition("21", "보안 기능",               "중요정보 평문 저장",       List.of("SENSITIVE_DATA_EXPOSURE")),
        new HanafosItemDefinition("22", "보안 기능",               "중요정보 평문 전송",       List.of("INSECURE_TRANSPORT")),
        new HanafosItemDefinition("23", "보안 기능",               "하드코드된 비밀번호",       List.of("HARDCODED_SECRET", "SECRET_EXPOSURE")),
        new HanafosItemDefinition("24", "보안 기능",               "충분하지 않은 키 길이 사용", List.of("WEAK_KEY")),
        new HanafosItemDefinition("25", "보안 기능",               "적절하지 않은 난수값 사용",  List.of("WEAK_RANDOM")),
        new HanafosItemDefinition("26", "보안 기능",               "NULL 패스워드 사용",        List.of()),
        new HanafosItemDefinition("27", "보안 기능",               "취약한 패스워드 허용",      List.of()),
        new HanafosItemDefinition("28", "보안 기능",               "사용자 하드코드된 계정 정보", List.of("HARDCODED_CREDENTIAL")),
        new HanafosItemDefinition("29", "보안 기능",               "부적절한 전자서명 확인",     List.of()),
        new HanafosItemDefinition("30", "보안 기능",               "부적절한 인증서 유효성 검증", List.of()),
        new HanafosItemDefinition("31", "시간 및 상태",            "TOCTOU 경쟁 조건",         List.of("RACE_CONDITION")),
        new HanafosItemDefinition("32", "시간 및 상태",            "종료되지 않는 반복문 또는 재귀함수", List.of()),
        new HanafosItemDefinition("33", "에러 처리",               "오류 메시지를 통한 정보노출", List.of("INFORMATION_DISCLOSURE")),
        new HanafosItemDefinition("34", "에러 처리",               "오류 상황 대응 부재",        List.of()),
        new HanafosItemDefinition("35", "에러 처리",               "부적절한 예외 처리",         List.of()),
        new HanafosItemDefinition("36", "코드 오류",               "Null Pointer 역참조",       List.of("NULL_POINTER")),
        new HanafosItemDefinition("37", "코드 오류",               "부적절한 자원 해제",         List.of("RESOURCE_LEAK")),
        new HanafosItemDefinition("38", "코드 오류",               "해제된 자원 사용",           List.of("USE_AFTER_FREE")),
        new HanafosItemDefinition("39", "코드 오류",               "초기화되지 않은 변수 사용",   List.of()),
        new HanafosItemDefinition("40", "캡슐화",                 "잘못된 세션에 의한 데이터 정보 노출", List.of("SESSION_FIXATION")),
        new HanafosItemDefinition("41", "캡슐화",                 "제거되지 않고 남은 디버그 코드", List.of("DEBUG_CODE")),
        new HanafosItemDefinition("42", "캡슐화",                 "시스템 데이터 정보 노출",      List.of("INFORMATION_DISCLOSURE")),
        new HanafosItemDefinition("43", "API 오용",               "DNS Lookup에 의존한 보안 결정", List.of())
    );

    // ── ISMS-P 개발보안 통제항목 정의 ────────────────────────────────────────

    private static final List<IsmsControlDefinition> ISMS_DEFINITIONS = List.of(
        new IsmsControlDefinition("2.8.1", "보안 요구사항 정의",          List.of()),
        new IsmsControlDefinition("2.8.2", "보안 요구사항 검토 및 시험",  List.of()),
        new IsmsControlDefinition("2.8.3", "시험 데이터 보안",            List.of()),
        new IsmsControlDefinition("2.8.4", "소스 프로그램 보안",          List.of("HARDCODED_SECRET", "SECRET_EXPOSURE", "HARDCODED_CREDENTIAL")),
        new IsmsControlDefinition("2.8.5", "입력 데이터 검증",            List.of("SQL_INJECTION", "XSS", "CODE_INJECTION", "PATH_TRAVERSAL")),
        new IsmsControlDefinition("2.8.6", "보안 기능",                   List.of("WEAK_CRYPTO", "WEAK_KEY", "WEAK_RANDOM", "SENSITIVE_DATA_EXPOSURE")),
        new IsmsControlDefinition("2.8.7", "암호화 적용",                 List.of("INSECURE_TRANSPORT", "SENSITIVE_DATA_EXPOSURE")),
        new IsmsControlDefinition("2.9.1", "변경관리",                    List.of()),
        new IsmsControlDefinition("2.9.2", "성능 및 장애관리",            List.of()),
        new IsmsControlDefinition("2.9.3", "백업 및 복구관리",            List.of()),
        new IsmsControlDefinition("2.9.4", "로그 및 접속기록 관리",        List.of("INFORMATION_DISCLOSURE")),
        new IsmsControlDefinition("2.9.5", "로그 및 접속기록 점검",        List.of()),
        new IsmsControlDefinition("2.9.6", "시간 동기화",                 List.of()),
        new IsmsControlDefinition("2.9.7", "정보시스템의 보안 검토 및 지원 종료", List.of())
    );
}
