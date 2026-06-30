package io.secureai.backend.domain.compliance.crawler;

import io.secureai.backend.domain.compliance.crawler.dto.DetailFetchResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.*;

/**
 * KisaDetailHtmlParser 단위 테스트.
 *
 * <p>네트워크 없이 픽스처 HTML 파일만 사용한다.
 * 픽스처: src/test/resources/fixtures/kisa_detail_page.html
 */
@DisplayName("KisaDetailHtmlParser 단위 테스트")
class KisaDetailHtmlParserTest {

    private KisaDetailHtmlParser parser;

    @BeforeEach
    void setUp() {
        parser = new KisaDetailHtmlParser();
    }

    @Test
    @DisplayName("정상 상세 HTML — 본문 텍스트가 추출된다")
    void parseDetail_normalHtml_bodyTextExtracted() throws IOException {
        String html = loadFixture("fixtures/kisa_detail_page.html");

        DetailFetchResult result = parser.parseDetail(html);

        assertThat(result.bodyText()).isNotBlank();
        assertThat(result.bodyText()).contains("사이버위협 동향");
    }

    @Test
    @DisplayName("정상 상세 HTML — 스크립트·스타일 태그가 제거된다")
    void parseDetail_normalHtml_scriptStyleStripped() throws IOException {
        String html = loadFixture("fixtures/kisa_detail_page.html");

        DetailFetchResult result = parser.parseDetail(html);

        assertThat(result.bodyText()).doesNotContain("alert(");
        assertThat(result.bodyText()).doesNotContain("display:none");
    }

    @Test
    @DisplayName("정상 상세 HTML — PDF 다운로드 URL 이 추출된다")
    void parseDetail_normalHtml_pdfUrlExtracted() throws IOException {
        String html = loadFixture("fixtures/kisa_detail_page.html");

        DetailFetchResult result = parser.parseDetail(html);

        assertThat(result.pdfDownloadUrls()).hasSize(1);
        assertThat(result.pdfDownloadUrls().get(0)).contains("2026_H1_cyber_threat.pdf");
    }

    @Test
    @DisplayName("정상 상세 HTML — HWP 파일은 PDF 목록에 포함되지 않는다")
    void parseDetail_normalHtml_hwpExcluded() throws IOException {
        String html = loadFixture("fixtures/kisa_detail_page.html");

        DetailFetchResult result = parser.parseDetail(html);

        assertThat(result.pdfDownloadUrls()).noneMatch(url -> url.endsWith(".hwp"));
    }

    @Test
    @DisplayName("정상 상세 HTML — PDF URL 이 절대 URL 이다")
    void parseDetail_normalHtml_pdfUrlIsAbsolute() throws IOException {
        String html = loadFixture("fixtures/kisa_detail_page.html");

        DetailFetchResult result = parser.parseDetail(html);

        assertThat(result.pdfDownloadUrls().get(0)).startsWith("https://");
    }

    @Test
    @DisplayName("본문 없는 HTML — 빈 bodyText 와 빈 URL 목록을 반환한다 (skip & log)")
    void parseDetail_noBodyHtml_returnsEmpty() throws IOException {
        String html = loadFixture("fixtures/kisa_detail_no_body.html");

        DetailFetchResult result = parser.parseDetail(html);

        assertThat(result.bodyText()).isBlank();
        assertThat(result.pdfDownloadUrls()).isEmpty();
    }

    @Test
    @DisplayName("null HTML — 예외 없이 empty 를 반환한다 (skip & log)")
    void parseDetail_nullHtml_returnsEmpty() {
        DetailFetchResult result = parser.parseDetail(null);

        assertThat(result.bodyText()).isBlank();
        assertThat(result.pdfDownloadUrls()).isEmpty();
    }

    @Test
    @DisplayName("빈 HTML — 예외 없이 empty 를 반환한다 (skip & log)")
    void parseDetail_emptyHtml_returnsEmpty() {
        DetailFetchResult result = parser.parseDetail("");

        assertThat(result.bodyText()).isBlank();
        assertThat(result.pdfDownloadUrls()).isEmpty();
    }

    @Test
    @DisplayName("정상 상세 HTML — 연속 공백이 단일 공백으로 정규화된다")
    void parseDetail_normalHtml_whitespaceNormalized() throws IOException {
        String html = loadFixture("fixtures/kisa_detail_page.html");

        DetailFetchResult result = parser.parseDetail(html);

        assertThat(result.bodyText()).doesNotContain("  ");
    }

    @Test
    @DisplayName("href 에 .pdf 확장자가 있는 링크 — PDF 목록에 포함된다 (href-only 판별)")
    void parseDetail_hrefContainsPdfExtension_included() {
        String html = "<html><body>" +
            "<div class=\"view-con\">본문</div>" +
            "<ul class=\"file-list\">" +
            "<a href=\"https://www.kisa.or.kr/files/report.pdf\">보안보고서</a>" +
            "</ul></body></html>";

        DetailFetchResult result = parser.parseDetail(html);

        assertThat(result.pdfDownloadUrls()).hasSize(1);
        assertThat(result.pdfDownloadUrls().get(0)).contains("report.pdf");
    }

    @Test
    @DisplayName("링크 텍스트만 .pdf 이고 href 는 .pdf 가 아닌 링크 — PDF 목록에 포함되지 않는다 (href-only 판별)")
    void parseDetail_linkTextPdfButHrefNotPdf_excluded() {
        // 공격자가 linkText 에 .pdf 를 넣어 HWP 파일 URL 을 위장하는 시나리오
        String html = "<html><body>" +
            "<div class=\"view-con\">본문</div>" +
            "<ul class=\"file-list\">" +
            "<a href=\"https://www.kisa.or.kr/fileDownload?type=hwp&amp;name=doc\">악성문서.pdf</a>" +
            "</ul></body></html>";

        DetailFetchResult result = parser.parseDetail(html);

        assertThat(result.pdfDownloadUrls()).isEmpty();
    }

    // ── 유틸 ──────────────────────────────────────────────────────────────────

    private String loadFixture(String path) throws IOException {
        try (InputStream is = getClass().getClassLoader().getResourceAsStream(path)) {
            if (is == null) {
                throw new IOException("Fixture not found: " + path);
            }
            return new String(is.readAllBytes(), StandardCharsets.UTF_8);
        }
    }
}
