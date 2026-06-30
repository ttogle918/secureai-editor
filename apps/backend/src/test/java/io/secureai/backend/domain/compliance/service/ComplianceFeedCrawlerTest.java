package io.secureai.backend.domain.compliance.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.secureai.backend.domain.compliance.crawler.FeedHtmlFetcher;
import io.secureai.backend.domain.compliance.crawler.KisaFeedHtmlParser;
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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.*;

/**
 * ComplianceFeedCrawler 단위 테스트.
 *
 * <p>규칙:
 * <ul>
 *   <li>네트워크 실제 호출 금지 — FeedHtmlFetcher 를 mock 으로 주입한다.</li>
 *   <li>픽스처 HTML 을 fetcher mock 에서 반환해 파서를 간접 검증한다.</li>
 *   <li>한 소스 실패 시 다른 소스 계속 진행(skip &amp; log) 검증은 KisaParser stub 사용.</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("ComplianceFeedCrawler 단위 테스트")
class ComplianceFeedCrawlerTest {

    @Mock FeedHtmlFetcher htmlFetcher;
    @Mock ComplianceFeedItemRepository repository;

    private ComplianceFeedCrawler crawler;

    @BeforeEach
    void setUp() {
        // KisaFeedHtmlParser 는 실제 구현체 사용 — 픽스처 HTML 로 파서 함께 검증
        KisaFeedHtmlParser kisaParser = new KisaFeedHtmlParser();
        crawler = new ComplianceFeedCrawler(htmlFetcher, kisaParser, repository, new ObjectMapper());
    }

    @Test
    @DisplayName("정상 픽스처 HTML — 3개 아이템을 저장하고 saved=3 을 반환한다")
    void refresh_normalFixture_saves3Items() throws IOException {
        String html = loadFixture("fixtures/kisa_board_list.html");
        given(htmlFetcher.fetch(anyString())).willReturn(html);
        given(repository.existsByContentHash(anyString())).willReturn(false);
        given(repository.save(any())).willAnswer(inv -> inv.getArgument(0));

        FeedRefreshResult result = crawler.refresh();

        assertThat(result.saved()).isEqualTo(3);
        assertThat(result.skipped()).isEqualTo(0);
        assertThat(result.failed()).isEqualTo(0);
    }

    @Test
    @DisplayName("dedup — 동일 contentHash 가 이미 존재하면 skipped 로 집계된다")
    void refresh_duplicateHash_itemSkipped() throws IOException {
        String html = loadFixture("fixtures/kisa_board_list.html");
        given(htmlFetcher.fetch(anyString())).willReturn(html);
        // 첫 번째 아이템만 이미 존재한다고 설정
        given(repository.existsByContentHash(anyString()))
                .willReturn(true)   // 1번째 호출
                .willReturn(false)  // 2번째 호출
                .willReturn(false); // 3번째 호출
        given(repository.save(any())).willAnswer(inv -> inv.getArgument(0));

        FeedRefreshResult result = crawler.refresh();

        assertThat(result.saved()).isEqualTo(2);
        assertThat(result.skipped()).isEqualTo(1);
    }

    @Test
    @DisplayName("dedup — 모든 아이템이 이미 존재하면 saved=0, skipped=3 이다")
    void refresh_allDuplicates_savedIsZero() throws IOException {
        String html = loadFixture("fixtures/kisa_board_list.html");
        given(htmlFetcher.fetch(anyString())).willReturn(html);
        given(repository.existsByContentHash(anyString())).willReturn(true);

        FeedRefreshResult result = crawler.refresh();

        assertThat(result.saved()).isEqualTo(0);
        assertThat(result.skipped()).isEqualTo(3);
        verify(repository, never()).save(any());
    }

    @Test
    @DisplayName("fetch 실패(null 반환) — 저장 없이 saved=0 을 반환하고 예외가 전파되지 않는다")
    void refresh_fetchReturnsNull_noSaveNoPropagation() {
        given(htmlFetcher.fetch(anyString())).willReturn(null);

        FeedRefreshResult result = crawler.refresh();

        assertThat(result.saved()).isEqualTo(0);
        verify(repository, never()).save(any());
    }

    @Test
    @DisplayName("fetch 중 예외 발생 — failed=1 로 집계하고 크롤 전체를 중단하지 않는다")
    void refresh_fetchThrows_failedCountedSkipLog() {
        given(htmlFetcher.fetch(anyString())).willThrow(new RuntimeException("Connection refused"));

        FeedRefreshResult result = crawler.refresh();

        // 예외 전파 없이 반환
        assertThat(result.failed()).isEqualTo(1);
        assertThat(result.saved()).isEqualTo(0);
    }

    @Test
    @DisplayName("저장된 엔티티는 AGENCY_POST 섹션으로 설정된다")
    void refresh_savedItem_sectionIsAgencyPost() throws IOException {
        String html = loadFixture("fixtures/kisa_board_list.html");
        given(htmlFetcher.fetch(anyString())).willReturn(html);
        given(repository.existsByContentHash(anyString())).willReturn(false);

        ArgumentCaptor<ComplianceFeedItem> captor = ArgumentCaptor.forClass(ComplianceFeedItem.class);
        given(repository.save(captor.capture())).willAnswer(inv -> inv.getArgument(0));

        crawler.refresh();

        List<ComplianceFeedItem> saved = captor.getAllValues();
        assertThat(saved).isNotEmpty();
        saved.forEach(item -> assertThat(item.getSection()).isEqualTo(FeedSection.AGENCY_POST));
    }

    @Test
    @DisplayName("저장된 엔티티의 contentHash 는 null 이 아니다")
    void refresh_savedItem_contentHashNotNull() throws IOException {
        String html = loadFixture("fixtures/kisa_board_list.html");
        given(htmlFetcher.fetch(anyString())).willReturn(html);
        given(repository.existsByContentHash(anyString())).willReturn(false);

        ArgumentCaptor<ComplianceFeedItem> captor = ArgumentCaptor.forClass(ComplianceFeedItem.class);
        given(repository.save(captor.capture())).willAnswer(inv -> inv.getArgument(0));

        crawler.refresh();

        List<ComplianceFeedItem> saved = captor.getAllValues();
        assertThat(saved).isNotEmpty();
        saved.forEach(item -> assertThat(item.getContentHash()).isNotNull());
    }

    @Test
    @DisplayName("빈 HTML 반환 시 저장 없이 saved=0 이다")
    void refresh_emptyHtml_noSave() {
        given(htmlFetcher.fetch(anyString())).willReturn("");

        FeedRefreshResult result = crawler.refresh();

        assertThat(result.saved()).isEqualTo(0);
        verify(repository, never()).save(any());
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
