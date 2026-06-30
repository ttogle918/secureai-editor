package io.secureai.backend.domain.compliance.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.secureai.backend.domain.compliance.crawler.FeedHtmlFetcher;
import io.secureai.backend.domain.compliance.crawler.KisaDetailHtmlParser;
import io.secureai.backend.domain.compliance.crawler.KisaFeedHtmlParser;
import io.secureai.backend.domain.compliance.crawler.PdfTextExtractor;
import io.secureai.backend.domain.compliance.crawler.dto.FeedRefreshResult;
import io.secureai.backend.domain.compliance.entity.ComplianceFeedItem;
import io.secureai.backend.domain.compliance.entity.FeedSection;
import io.secureai.backend.domain.compliance.repository.ComplianceFeedItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("ComplianceFeedCrawler 단위 테스트")
class ComplianceFeedCrawlerTest {

    @Mock FeedHtmlFetcher htmlFetcher;
    @Mock PdfTextExtractor pdfTextExtractor;
    @Mock ComplianceFeedItemRepository repository;

    private ComplianceFeedCrawler crawler;
    private static final String BOARD_URL = "https://www.kisa.or.kr/2060204/form";

    @BeforeEach
    void setUp() {
        KisaFeedHtmlParser kisaListParser = new KisaFeedHtmlParser();
        KisaDetailHtmlParser kisaDetailParser = new KisaDetailHtmlParser();
        crawler = new ComplianceFeedCrawler(
                htmlFetcher, kisaListParser, kisaDetailParser,
                pdfTextExtractor, repository, new ObjectMapper()
        );
    }

    @Test
    @DisplayName("목록 + 상세 정상 - 3개 아이템 저장, saved=3")
    void refresh_normalFixture_saves3Items() throws IOException {
        String listHtml   = loadFixture("fixtures/kisa_board_list.html");
        String detailHtml = loadFixture("fixtures/kisa_detail_page.html");
        given(htmlFetcher.fetch(eq(BOARD_URL))).willReturn(listHtml);
        given(htmlFetcher.fetch(argThat(u -> u != null && u.contains("postSeq")))).willReturn(detailHtml);
        given(htmlFetcher.fetchBytes(anyString())).willReturn(null);
        given(repository.existsByContentHash(anyString())).willReturn(false);
        given(repository.save(any())).willAnswer(inv -> inv.getArgument(0));

        FeedRefreshResult result = crawler.refresh();

        assertThat(result.saved()).isEqualTo(3);
        assertThat(result.skipped()).isEqualTo(0);
        assertThat(result.failed()).isEqualTo(0);
    }

    @Test
    @DisplayName("dedup - 동일 contentHash 가 이미 존재하면 skipped 로 집계된다")
    void refresh_duplicateHash_itemSkipped() throws IOException {
        String listHtml   = loadFixture("fixtures/kisa_board_list.html");
        String detailHtml = loadFixture("fixtures/kisa_detail_page.html");
        given(htmlFetcher.fetch(eq(BOARD_URL))).willReturn(listHtml);
        given(htmlFetcher.fetch(argThat(u -> u != null && u.contains("postSeq")))).willReturn(detailHtml);
        given(htmlFetcher.fetchBytes(anyString())).willReturn(null);
        given(repository.existsByContentHash(anyString()))
                .willReturn(true).willReturn(false).willReturn(false);
        given(repository.save(any())).willAnswer(inv -> inv.getArgument(0));

        FeedRefreshResult result = crawler.refresh();

        assertThat(result.saved()).isEqualTo(2);
        assertThat(result.skipped()).isEqualTo(1);
    }

    @Test
    @DisplayName("dedup - 모든 아이템이 이미 존재하면 saved=0, skipped=3")
    void refresh_allDuplicates_savedIsZero() throws IOException {
        String listHtml   = loadFixture("fixtures/kisa_board_list.html");
        String detailHtml = loadFixture("fixtures/kisa_detail_page.html");
        given(htmlFetcher.fetch(eq(BOARD_URL))).willReturn(listHtml);
        given(htmlFetcher.fetch(argThat(u -> u != null && u.contains("postSeq")))).willReturn(detailHtml);
        given(htmlFetcher.fetchBytes(anyString())).willReturn(null);
        given(repository.existsByContentHash(anyString())).willReturn(true);

        FeedRefreshResult result = crawler.refresh();

        assertThat(result.saved()).isEqualTo(0);
        assertThat(result.skipped()).isEqualTo(3);
        verify(repository, never()).save(any());
    }

    @Test
    @DisplayName("목록 fetch 실패(null) - 저장 없이 saved=0 을 반환한다")
    void refresh_listFetchNull_noSave() {
        given(htmlFetcher.fetch(eq(BOARD_URL))).willReturn(null);

        FeedRefreshResult result = crawler.refresh();

        assertThat(result.saved()).isEqualTo(0);
        verify(repository, never()).save(any());
    }

    @Test
    @DisplayName("목록 fetch 중 예외 - failed=1 로 집계하고 크롤 전체를 중단하지 않는다")
    void refresh_listFetchThrows_failedCounted() {
        given(htmlFetcher.fetch(eq(BOARD_URL))).willThrow(new RuntimeException("Connection refused"));

        FeedRefreshResult result = crawler.refresh();

        assertThat(result.failed()).isEqualTo(1);
        assertThat(result.saved()).isEqualTo(0);
    }

    @Test
    @DisplayName("상세 fetch 성공 - 저장된 엔티티에 content 가 채워진다")
    void refresh_detailFetchSuccess_contentFilled() throws IOException {
        String listHtml   = loadFixture("fixtures/kisa_board_list.html");
        String detailHtml = loadFixture("fixtures/kisa_detail_page.html");
        given(htmlFetcher.fetch(eq(BOARD_URL))).willReturn(listHtml);
        given(htmlFetcher.fetch(argThat(u -> u != null && u.contains("postSeq")))).willReturn(detailHtml);
        given(htmlFetcher.fetchBytes(anyString())).willReturn(null);
        given(repository.existsByContentHash(anyString())).willReturn(false);

        ArgumentCaptor<ComplianceFeedItem> captor = ArgumentCaptor.forClass(ComplianceFeedItem.class);
        given(repository.save(captor.capture())).willAnswer(inv -> inv.getArgument(0));

        crawler.refresh();

        captor.getAllValues().forEach(item ->
            assertThat(item.getContent()).isNotNull()
        );
    }

    @Test
    @DisplayName("상세 fetch 실패(null) - content=null 이지만 title 등 목록 정보는 보존된다")
    void refresh_detailFetchNull_listInfoPreservedContentNull() throws IOException {
        String listHtml = loadFixture("fixtures/kisa_board_list.html");
        given(htmlFetcher.fetch(eq(BOARD_URL))).willReturn(listHtml);
        given(htmlFetcher.fetch(argThat(u -> u != null && u.contains("postSeq")))).willReturn(null);
        given(repository.existsByContentHash(anyString())).willReturn(false);

        ArgumentCaptor<ComplianceFeedItem> captor = ArgumentCaptor.forClass(ComplianceFeedItem.class);
        given(repository.save(captor.capture())).willAnswer(inv -> inv.getArgument(0));

        FeedRefreshResult result = crawler.refresh();

        assertThat(result.saved()).isEqualTo(3);
        captor.getAllValues().forEach(item -> {
            assertThat(item.getTitle()).isNotBlank();
            assertThat(item.getContent()).isNull();
        });
    }

    @Test
    @DisplayName("상세 fetch 예외 - content=null 유지, 전체 크롤 계속(failed 아님)")
    void refresh_detailFetchThrows_contentNullCrawlContinues() throws IOException {
        String listHtml = loadFixture("fixtures/kisa_board_list.html");
        given(htmlFetcher.fetch(eq(BOARD_URL))).willReturn(listHtml);
        given(htmlFetcher.fetch(argThat(u -> u != null && u.contains("postSeq"))))
                .willThrow(new RuntimeException("Timeout"));
        given(repository.existsByContentHash(anyString())).willReturn(false);
        given(repository.save(any())).willAnswer(inv -> inv.getArgument(0));

        FeedRefreshResult result = crawler.refresh();

        assertThat(result.saved()).isEqualTo(3);
        assertThat(result.failed()).isEqualTo(0);
    }

    @Test
    @DisplayName("PDF 다운로드 성공 - content 에 PDF 텍스트가 포함된다")
    void refresh_withPdf_contentIncludesPdfText() throws IOException {
        String listHtml   = loadFixture("fixtures/kisa_board_list.html");
        String detailHtml = loadFixture("fixtures/kisa_detail_page.html");
        byte[] pdfBytes   = "fake-pdf".getBytes();

        given(htmlFetcher.fetch(eq(BOARD_URL))).willReturn(listHtml);
        given(htmlFetcher.fetch(argThat(u -> u != null && u.contains("postSeq")))).willReturn(detailHtml);
        given(htmlFetcher.fetchBytes(anyString())).willReturn(pdfBytes);
        given(pdfTextExtractor.extract(pdfBytes)).willReturn("PDF 보안 분석 내용");
        given(repository.existsByContentHash(anyString())).willReturn(false);

        ArgumentCaptor<ComplianceFeedItem> captor = ArgumentCaptor.forClass(ComplianceFeedItem.class);
        given(repository.save(captor.capture())).willAnswer(inv -> inv.getArgument(0));

        crawler.refresh();

        captor.getAllValues().forEach(item ->
            assertThat(item.getContent()).contains("PDF 보안 분석 내용")
        );
    }

    @Test
    @DisplayName("PDF 추출 빈 문자열 - content 는 bodyText 만 포함, [첨부 PDF] 구분자 없음")
    void refresh_pdfExtractionReturnsEmpty_contentUsesBodyTextOnly() throws IOException {
        String listHtml   = loadFixture("fixtures/kisa_board_list.html");
        String detailHtml = loadFixture("fixtures/kisa_detail_page.html");
        byte[] pdfBytes   = "fake".getBytes();

        given(htmlFetcher.fetch(eq(BOARD_URL))).willReturn(listHtml);
        given(htmlFetcher.fetch(argThat(u -> u != null && u.contains("postSeq")))).willReturn(detailHtml);
        given(htmlFetcher.fetchBytes(anyString())).willReturn(pdfBytes);
        given(pdfTextExtractor.extract(pdfBytes)).willReturn("");
        given(repository.existsByContentHash(anyString())).willReturn(false);

        ArgumentCaptor<ComplianceFeedItem> captor = ArgumentCaptor.forClass(ComplianceFeedItem.class);
        given(repository.save(captor.capture())).willAnswer(inv -> inv.getArgument(0));

        crawler.refresh();

        captor.getAllValues().forEach(item -> {
            if (item.getContent() != null) {
                assertThat(item.getContent()).doesNotContain("[첨부 PDF]");
            }
        });
    }

    @Test
    @DisplayName("content 길이 상한 - CONTENT_MAX_LEN 초과 시 truncate 된다")
    void refresh_contentExceedsLimit_truncated() throws IOException {
        String listHtml   = loadFixture("fixtures/kisa_board_list.html");
        String detailHtml = loadFixture("fixtures/kisa_detail_page.html");
        String longText   = "A".repeat(ComplianceFeedCrawler.CONTENT_MAX_LEN + 5000);

        given(htmlFetcher.fetch(eq(BOARD_URL))).willReturn(listHtml);
        given(htmlFetcher.fetch(argThat(u -> u != null && u.contains("postSeq")))).willReturn(detailHtml);
        given(htmlFetcher.fetchBytes(anyString())).willReturn(new byte[]{1});
        given(pdfTextExtractor.extract(any())).willReturn(longText);
        given(repository.existsByContentHash(anyString())).willReturn(false);

        ArgumentCaptor<ComplianceFeedItem> captor = ArgumentCaptor.forClass(ComplianceFeedItem.class);
        given(repository.save(captor.capture())).willAnswer(inv -> inv.getArgument(0));

        crawler.refresh();

        captor.getAllValues().stream()
            .filter(item -> item.getContent() != null)
            .forEach(item ->
                assertThat(item.getContent().length()).isLessThanOrEqualTo(ComplianceFeedCrawler.CONTENT_MAX_LEN)
            );
    }

    @Test
    @DisplayName("저장된 엔티티는 AGENCY_POST 섹션으로 설정된다")
    void refresh_savedItem_sectionIsAgencyPost() throws IOException {
        String listHtml   = loadFixture("fixtures/kisa_board_list.html");
        String detailHtml = loadFixture("fixtures/kisa_detail_page.html");
        given(htmlFetcher.fetch(eq(BOARD_URL))).willReturn(listHtml);
        given(htmlFetcher.fetch(argThat(u -> u != null && u.contains("postSeq")))).willReturn(detailHtml);
        given(htmlFetcher.fetchBytes(anyString())).willReturn(null);
        given(repository.existsByContentHash(anyString())).willReturn(false);

        ArgumentCaptor<ComplianceFeedItem> captor = ArgumentCaptor.forClass(ComplianceFeedItem.class);
        given(repository.save(captor.capture())).willAnswer(inv -> inv.getArgument(0));

        crawler.refresh();

        captor.getAllValues().forEach(item ->
            assertThat(item.getSection()).isEqualTo(FeedSection.AGENCY_POST)
        );
    }

    @Test
    @DisplayName("저장된 엔티티의 contentHash 는 null 이 아니다")
    void refresh_savedItem_contentHashNotNull() throws IOException {
        String listHtml   = loadFixture("fixtures/kisa_board_list.html");
        String detailHtml = loadFixture("fixtures/kisa_detail_page.html");
        given(htmlFetcher.fetch(eq(BOARD_URL))).willReturn(listHtml);
        given(htmlFetcher.fetch(argThat(u -> u != null && u.contains("postSeq")))).willReturn(detailHtml);
        given(htmlFetcher.fetchBytes(anyString())).willReturn(null);
        given(repository.existsByContentHash(anyString())).willReturn(false);

        ArgumentCaptor<ComplianceFeedItem> captor = ArgumentCaptor.forClass(ComplianceFeedItem.class);
        given(repository.save(captor.capture())).willAnswer(inv -> inv.getArgument(0));

        crawler.refresh();

        captor.getAllValues().forEach(item ->
            assertThat(item.getContentHash()).isNotNull()
        );
    }

    @Test
    @DisplayName("SSRF 방어 — sourceUrl 이 허용 외 호스트이면 상세 fetch 를 하지 않는다")
    void refresh_nonAllowedHostInSourceUrl_detailFetchSkipped() {
        // 외부 절대 URL 을 포함하는 최소 목록 HTML (KisaFeedHtmlParser 가 파싱 가능한 구조)
        String listHtmlWithBadUrl = "<html><body><table class=\"tbl_list\"><tbody><tr>" +
            "<td class=\"num\">1</td>" +
            "<td class=\"title\"><a href=\"https://evil.example.com/steal\">악성 링크</a></td>" +
            "<td class=\"date\">2026.01.15</td>" +
            "<td class=\"file\">-</td>" +
            "</tr></tbody></table></body></html>";

        given(htmlFetcher.fetch(eq(BOARD_URL))).willReturn(listHtmlWithBadUrl);
        given(repository.existsByContentHash(any())).willReturn(false);

        ArgumentCaptor<ComplianceFeedItem> captor = ArgumentCaptor.forClass(ComplianceFeedItem.class);
        given(repository.save(captor.capture())).willAnswer(inv -> inv.getArgument(0));

        crawler.refresh();

        // evil.example.com 으로의 fetch 는 발생하면 안 된다
        verify(htmlFetcher, never()).fetch(argThat(u -> u != null && u.contains("evil.example.com")));
        // content 는 null (상세 fetch 스킵)
        captor.getAllValues().forEach(item -> assertThat(item.getContent()).isNull());
    }

    @Test
    @DisplayName("SSRF 방어 — PDF URL 이 클라우드 메타데이터 IP(169.254.169.254)이면 fetchBytes 를 하지 않는다")
    void appendPdfText_metadataIpInPdfUrl_fetchBytesSkipped() throws IOException {
        String listHtml = loadFixture("fixtures/kisa_board_list.html");
        // 상세 페이지: 본문 있고, 첨부는 클라우드 메타데이터 IP 의 PDF
        String detailHtmlMetadataIp = "<html><body>" +
            "<div class=\"view-con\">정상 본문 내용입니다.</div>" +
            "<ul class=\"file-list\">" +
            "<a href=\"http://169.254.169.254/latest/meta-data/report.pdf\">메타데이터 탈취</a>" +
            "</ul></body></html>";

        given(htmlFetcher.fetch(eq(BOARD_URL))).willReturn(listHtml);
        given(htmlFetcher.fetch(argThat(u -> u != null && u.contains("postSeq")))).willReturn(detailHtmlMetadataIp);
        given(repository.existsByContentHash(anyString())).willReturn(false);
        given(repository.save(any())).willAnswer(inv -> inv.getArgument(0));

        crawler.refresh();

        // 169.254.x.x 에 대한 fetchBytes 는 발생하면 안 된다
        verify(htmlFetcher, never()).fetchBytes(argThat(u -> u != null && u.contains("169.254.169.254")));
    }

    private String loadFixture(String path) throws IOException {
        try (InputStream is = getClass().getClassLoader().getResourceAsStream(path)) {
            if (is == null) throw new IOException("Fixture not found: " + path);
            return new String(is.readAllBytes(), StandardCharsets.UTF_8);
        }
    }
}