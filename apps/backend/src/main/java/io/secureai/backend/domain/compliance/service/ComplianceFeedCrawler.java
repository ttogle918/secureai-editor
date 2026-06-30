package io.secureai.backend.domain.compliance.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.secureai.backend.domain.compliance.crawler.FeedHtmlFetcher;
import io.secureai.backend.domain.compliance.crawler.FeedHtmlParser;
import io.secureai.backend.domain.compliance.crawler.FeedSource;
import io.secureai.backend.domain.compliance.crawler.dto.CrawledFeedItemDto;
import io.secureai.backend.domain.compliance.crawler.dto.FeedRefreshResult;
import io.secureai.backend.domain.compliance.entity.ComplianceFeedItem;
import io.secureai.backend.domain.compliance.entity.FeedSection;
import io.secureai.backend.domain.compliance.repository.ComplianceFeedItemRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;

/**
 * 컴플라이언스 피드 크롤러 서비스.
 *
 * <p>각 소스에 대해 (1) HTML fetch → (2) 파싱 → (3) dedup → (4) 저장을 오케스트레이션한다.
 * 개별 소스 실패는 전체 크롤을 중단하지 않는다 (skip &amp; log 원칙).
 *
 * <p>설계 분리:
 * <ul>
 *   <li>{@link FeedHtmlFetcher} — 네트워크 fetch (교체·mock 가능)</li>
 *   <li>{@code FeedHtmlParser} — 순수 HTML 파싱 (단위 테스트 가능)</li>
 *   <li>이 클래스 — fetch + parse + dedup + save 오케스트레이션</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ComplianceFeedCrawler {

    /**
     * contentHash 계산 시 사용하는 preview 최대 길이.
     * preview = summary 앞 N자. summary 가 null 이면 content 앞 N자로 대체.
     */
    private static final int HASH_PREVIEW_LEN = 200;

    private final FeedHtmlFetcher htmlFetcher;
    /** DIP: 구체 클래스가 아닌 FeedHtmlParser 인터페이스에 의존한다. */
    private final FeedHtmlParser kisaParser;
    private final ComplianceFeedItemRepository repository;
    private final ObjectMapper objectMapper;

    /**
     * 모든 등록 소스를 크롤링하고 신규 아이템을 저장한다.
     *
     * <p>소스별 실패는 개수로 집계하고 계속 진행한다.
     * 민감 정보를 포함하지 않으므로 WARN 레벨 로그로 URL 과 사유를 기록한다.
     *
     * @return 저장/스킵/실패 건수를 담은 결과 DTO
     */
    @Transactional
    public FeedRefreshResult refresh() {
        List<FeedSource> sources = buildSources();
        log.info("[compliance-crawler] 크롤 시작 sources={}", sources.size());

        int saved = 0, skipped = 0, failed = 0;
        for (FeedSource source : sources) {
            try {
                int[] counts = crawlSource(source);
                saved   += counts[0];
                skipped += counts[1];
            } catch (Exception e) {
                // 개별 소스 실패 — 전체 크롤 중단 금지
                log.warn("[compliance-crawler] 소스 크롤 실패 url={} cause={}", source.url(), e.getMessage());
                failed++;
            }
        }

        log.info("[compliance-crawler] 크롤 완료 saved={} skipped={} failed={}", saved, skipped, failed);
        return new FeedRefreshResult(saved, skipped, failed);
    }

    /**
     * 소스 목록을 빌드한다. 소스 추가 시 이 메서드에만 등록한다.
     *
     * <p>URL 은 {@link FeedSource} 상수로 관리해 매직 스트링을 방지한다.
     */
    private List<FeedSource> buildSources() {
        return List.of(
                new FeedSource(FeedSource.KISA_BOARD_URL, kisaParser)
        );
    }

    /**
     * 단일 소스를 크롤링한다.
     *
     * @return [saved, skipped] 배열
     */
    private int[] crawlSource(FeedSource source) {
        String html = htmlFetcher.fetch(source.url());
        if (html == null || html.isBlank()) {
            log.warn("[compliance-crawler] HTML fetch 결과 없음 — 스킵 url={}", source.url());
            return new int[]{0, 0};
        }

        List<CrawledFeedItemDto> items = source.parser().parse(html);
        log.info("[compliance-crawler] 파싱 완료 url={} items={}", source.url(), items.size());

        int saved = 0, skipped = 0;
        for (CrawledFeedItemDto dto : items) {
            if (saveOrSkip(dto)) {
                saved++;
            } else {
                skipped++;
            }
        }
        return new int[]{saved, skipped};
    }

    /**
     * 아이템을 저장하거나 중복이면 스킵한다.
     *
     * @return true = 저장됨, false = 중복 스킵
     */
    private boolean saveOrSkip(CrawledFeedItemDto dto) {
        String hash = computeContentHash(dto);

        if (hash != null && repository.existsByContentHash(hash)) {
            return false;
        }

        ComplianceFeedItem entity = toEntity(dto, hash);
        repository.save(entity);
        return true;
    }

    /**
     * contentHash = SHA-256(sourceUrl + summary/content 앞 200자).
     *
     * <p>엔티티 주석 규칙: SHA-256(source_url + content_preview).
     * sourceUrl 이 없으면 null 반환 — 저장은 허용하되 dedup 미적용.
     */
    private String computeContentHash(CrawledFeedItemDto dto) {
        if (dto.sourceUrl() == null || dto.sourceUrl().isBlank()) {
            return null;
        }
        String preview = buildPreview(dto);
        String input   = dto.sourceUrl() + preview;
        return sha256(input);
    }

    private String buildPreview(CrawledFeedItemDto dto) {
        String base = dto.summary() != null ? dto.summary() : (dto.content() != null ? dto.content() : "");
        return base.length() <= HASH_PREVIEW_LEN ? base : base.substring(0, HASH_PREVIEW_LEN);
    }

    private ComplianceFeedItem toEntity(CrawledFeedItemDto dto, String hash) {
        return ComplianceFeedItem.builder()
                .section(FeedSection.AGENCY_POST)
                .agency(dto.agency())
                .category(dto.category())
                .source(dto.source())
                .title(dto.title())
                .summary(dto.summary())
                .content(dto.content())
                .sourceUrl(dto.sourceUrl())
                .publishedDate(dto.publishedDate())
                .files(serializeFiles(dto.files()))
                .contentHash(hash)
                .sortOrder(0)
                .build();
    }

    private String serializeFiles(List<CrawledFeedItemDto.FileMetaDto> files) {
        if (files == null || files.isEmpty()) {
            return "[]";
        }
        try {
            return objectMapper.writeValueAsString(files);
        } catch (JsonProcessingException e) {
            log.warn("[compliance-crawler] files 직렬화 실패 — 빈 배열로 대체: {}", e.getMessage());
            return "[]";
        }
    }

    private String sha256(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            // SHA-256 은 모든 JVM 이 지원해야 하므로 실패하면 로그만 남긴다
            log.error("[compliance-crawler] SHA-256 계산 실패: {}", e.getMessage());
            return null;
        }
    }
}
