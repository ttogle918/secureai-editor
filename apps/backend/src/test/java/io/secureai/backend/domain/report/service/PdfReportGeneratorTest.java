package io.secureai.backend.domain.report.service;

import io.secureai.backend.domain.analysis.entity.AnalysisSession;
import io.secureai.backend.domain.analysis.entity.Vulnerability;
import io.secureai.backend.domain.project.entity.Project;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;

class PdfReportGeneratorTest {

    private PdfReportGenerator generator;
    private Project project;
    private AnalysisSession session;

    @BeforeEach
    void setUp() {
        generator = new PdfReportGenerator();

        project = Project.builder().name("TestProject").sourceType("GITHUB").build();
        ReflectionTestUtils.setField(project, "id", UUID.randomUUID());

        session = AnalysisSession.builder().build();
        ReflectionTestUtils.setField(session, "id", UUID.randomUUID());
    }

    // -----------------------------------------------------------------------
    // TC-1: 빈 취약점 목록으로 PDF 생성 — 바이트 배열이 반환된다
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("generate — 빈 취약점 목록으로도 PDF 바이트 배열이 반환된다")
    void generate_with_empty_vulns_returns_pdf_bytes() {
        byte[] result = generator.generate(List.of(), project, session);

        assertThat(result).isNotNull();
        assertThat(result.length).isGreaterThan(0);
        // PDF 파일 시그니처 확인
        assertThat(new String(result, 0, 4)).isEqualTo("%PDF");
    }

    // -----------------------------------------------------------------------
    // TC-2: 취약점이 있을 때 PDF 생성
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("generate — 취약점 목록이 있으면 PDF가 생성된다")
    void generate_with_vulns_returns_non_empty_pdf() {
        Vulnerability vuln = Vulnerability.builder()
                .filePath("src/main/java/Dao.java")
                .lineNumber(42)
                .vulnType("SQL_INJECTION")
                .severity("CRITICAL")
                .description("사용자 입력이 SQL 쿼리에 직접 사용됩니다.")
                .owasp("A03:2021")
                .cwe("CWE-89")
                .fingerprint("abc123")
                .build();
        ReflectionTestUtils.setField(vuln, "id", UUID.randomUUID());

        byte[] result = generator.generate(List.of(vuln), project, session);

        assertThat(result).isNotNull();
        assertThat(result.length).isGreaterThan(100);
        assertThat(new String(result, 0, 4)).isEqualTo("%PDF");
    }

    // -----------------------------------------------------------------------
    // TC-3: session이 null이어도 PDF 생성
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("generate — session이 null이어도 PDF가 생성된다")
    void generate_with_null_session_returns_pdf() {
        byte[] result = generator.generate(List.of(), project, null);

        assertThat(result).isNotNull();
        assertThat(new String(result, 0, 4)).isEqualTo("%PDF");
    }

    // -----------------------------------------------------------------------
    // TC-4: 다양한 심각도의 취약점으로 PDF 생성
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("generate — 여러 심각도 취약점을 포함한 PDF가 생성된다")
    void generate_with_multiple_severity_vulns_returns_pdf() {
        List<Vulnerability> vulns = List.of(
                buildVuln("CRITICAL", "SQL_INJECTION", "A03:2021"),
                buildVuln("HIGH", "XSS", "A03:2021"),
                buildVuln("MEDIUM", "PATH_TRAVERSAL", "A01:2021"),
                buildVuln("LOW", "INFO_DISCLOSURE", null),
                buildVuln("INFO", "WEAK_CRYPTO", null)
        );

        byte[] result = generator.generate(vulns, project, session);

        assertThat(result).isNotNull();
        assertThat(result.length).isGreaterThan(500);
        assertThat(new String(result, 0, 4)).isEqualTo("%PDF");
    }

    private Vulnerability buildVuln(String severity, String type, String owasp) {
        Vulnerability vuln = Vulnerability.builder()
                .filePath("src/Controller.java")
                .lineNumber(10)
                .vulnType(type)
                .severity(severity)
                .description("테스트 취약점 설명")
                .owasp(owasp)
                .fingerprint(UUID.randomUUID().toString())
                .build();
        ReflectionTestUtils.setField(vuln, "id", UUID.randomUUID());
        return vuln;
    }
}
