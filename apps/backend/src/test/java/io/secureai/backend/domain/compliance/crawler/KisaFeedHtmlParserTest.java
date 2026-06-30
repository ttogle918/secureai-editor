package io.secureai.backend.domain.compliance.crawler;

import io.secureai.backend.domain.compliance.crawler.dto.CrawledFeedItemDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.*;

/**
 * KisaFeedHtmlParser 단위 테스트.
 *
 * <p>네트워크 없이 픽스처 HTML 파일만 사용한다.
 * 픽스처: src/test/resources/fixtures/kisa_board_list.html
 */
@DisplayName("KisaFeedHtmlParser 단위 테스트")
class KisaFeedHtmlParserTest {

    private KisaFeedHtmlParser parser;

    @BeforeEach
    void setUp() {
        parser = new KisaFeedHtmlParser();
    }

    @Test
    @DisplayName("정상 HTML — 게시판 행 3개를 파싱해 3개의 DTO 를 반환한다")
    void parse_normalHtml_returnsExpectedItems() throws IOException {
        String html = loadFixture("fixtures/kisa_board_list.html");

        List<CrawledFeedItemDto> result = parser.parse(html);

        assertThat(result).hasSize(3);
    }

    @Test
    @DisplayName("정상 HTML — 첫 번째 아이템의 제목이 올바르게 추출된다")
    void parse_firstItem_titleExtractedCorrectly() throws IOException {
        String html = loadFixture("fixtures/kisa_board_list.html");

        List<CrawledFeedItemDto> result = parser.parse(html);

        assertThat(result.get(0).title()).isEqualTo("2026년 상반기 주요 사이버위협 동향 보고서");
    }

    @Test
    @DisplayName("정상 HTML — 첫 번째 아이템의 게시일이 2026-06-27 로 파싱된다")
    void parse_firstItem_publishedDateParsed() throws IOException {
        String html = loadFixture("fixtures/kisa_board_list.html");

        List<CrawledFeedItemDto> result = parser.parse(html);

        assertThat(result.get(0).publishedDate()).isEqualTo(LocalDate.of(2026, 6, 27));
    }

    @Test
    @DisplayName("정상 HTML — sourceUrl 이 절대 URL 로 변환된다")
    void parse_firstItem_sourceUrlIsAbsolute() throws IOException {
        String html = loadFixture("fixtures/kisa_board_list.html");

        List<CrawledFeedItemDto> result = parser.parse(html);

        assertThat(result.get(0).sourceUrl()).startsWith("https://www.kisa.or.kr/");
    }

    @Test
    @DisplayName("정상 HTML — 첨부파일 있는 행은 files 목록에 파일 메타가 포함된다")
    void parse_firstItem_filesExtracted() throws IOException {
        String html = loadFixture("fixtures/kisa_board_list.html");

        List<CrawledFeedItemDto> result = parser.parse(html);

        // 첫 번째 행은 첨부파일 있음
        assertThat(result.get(0).files()).isNotEmpty();
        assertThat(result.get(0).files().get(0).name()).contains(".pdf");
        assertThat(result.get(0).files().get(0).type()).isEqualTo("PDF");
    }

    @Test
    @DisplayName("정상 HTML — 첨부파일 없는 행은 files 가 빈 목록이다")
    void parse_thirdItem_noFiles() throws IOException {
        String html = loadFixture("fixtures/kisa_board_list.html");

        List<CrawledFeedItemDto> result = parser.parse(html);

        // 세 번째 행은 첨부 없음 (td.file = '-')
        assertThat(result.get(2).files()).isEmpty();
    }

    @Test
    @DisplayName("정상 HTML — agency/category/source 가 KISA 로 설정된다")
    void parse_normalHtml_agencyIskisa() throws IOException {
        String html = loadFixture("fixtures/kisa_board_list.html");

        List<CrawledFeedItemDto> result = parser.parse(html);

        assertThat(result.get(0).agency()).isEqualTo("KISA");
        assertThat(result.get(0).source()).isEqualTo("KISA");
    }

    @Test
    @DisplayName("정상 HTML — content 는 null (목록 페이지만 수집, 원문 복제 금지)")
    void parse_normalHtml_contentIsNull() throws IOException {
        String html = loadFixture("fixtures/kisa_board_list.html");

        List<CrawledFeedItemDto> result = parser.parse(html);

        // 목록 페이지만 수집하므로 원문 content 는 null
        result.forEach(item -> assertThat(item.content()).isNull());
    }

    @Test
    @DisplayName("빈 HTML — 예외 없이 빈 목록을 반환한다 (skip & log)")
    void parse_emptyHtml_returnsEmptyList() {
        List<CrawledFeedItemDto> result = parser.parse("");

        assertThat(result).isEmpty();
    }

    @Test
    @DisplayName("null HTML — 예외 없이 빈 목록을 반환한다 (skip & log)")
    void parse_nullHtml_returnsEmptyList() {
        List<CrawledFeedItemDto> result = parser.parse(null);

        assertThat(result).isEmpty();
    }

    @Test
    @DisplayName("게시판 구조가 없는 HTML — 빈 목록을 반환하고 예외가 전파되지 않는다")
    void parse_brokenHtml_returnsEmptyList() throws IOException {
        String html = loadFixture("fixtures/kisa_board_broken.html");

        assertThatCode(() -> parser.parse(html)).doesNotThrowAnyException();
        assertThat(parser.parse(html)).isEmpty();
    }

    @Test
    @DisplayName("getAgency — 'KISA' 를 반환한다")
    void getAgency_returnsKisa() {
        assertThat(parser.getAgency()).isEqualTo("KISA");
    }

    @Test
    @DisplayName("getCategory — 카테고리 문자열을 반환한다")
    void getCategory_returnsCategory() {
        assertThat(parser.getCategory()).isEqualTo(KisaFeedHtmlParser.CATEGORY);
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
