package io.secureai.backend.domain.compliance.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.secureai.backend.domain.compliance.crawler.FeedDetailHtmlParser;
import io.secureai.backend.domain.compliance.crawler.FeedHtmlFetcher;
import io.secureai.backend.domain.compliance.crawler.FeedHtmlParser;
import io.secureai.backend.domain.compliance.crawler.FeedSource;
import io.secureai.backend.domain.compliance.crawler.PdfTextExtractor;
import io.secureai.backend.domain.compliance.crawler.dto.CrawledFeedItemDto;
import io.secureai.backend.domain.compliance.crawler.dto.DetailFetchResult;
import io.secureai.backend.domain.compliance.crawler.dto.FeedRefreshResult;
import io.secureai.backend.domain.compliance.entity.ComplianceFeedItem;
import io.secureai.backend.domain.compliance.entity.FeedSection;
import io.secureai.backend.domain.compliance.repository.ComplianceFeedItemRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;
import java.util.Set;

/**
 * 컴플라이언스 피드 크롤러 서비스.
 *
 * <p>각 소스에 대해 다음 단계를 오케스트레이션한다:
 * (1) 목록 페이지 fetch → (2) 목록 파싱 → (3) 각 아이템 상세 페이지 fetch(best-effort) →
 * (4) 상세 파싱 + PDF 텍스트 추출(best-effort) → (5) dedup → (6) 저장.
 *
 * <p>설계 분리 (DIP 준수 — 모든 의존은 인터페이스):
 * <ul>
 *   <li>{@link FeedHtmlFetcher}       — 네트워크 fetch (HTML + 바이너리)</li>
 *   <li>{@link FeedHtmlParser}        — 목록 HTML 파싱 (순수 함수)</li>
 *   <li>{@link FeedDetailHtmlParser}  — 상세 HTML 파싱 (순수 함수)</li>
 *   <li>{@link PdfTextExtractor}      — PDF 텍스트 추출</li>
 *   <li>이 클래스                      — 오케스트레이션만 담당 (SRP)</li>
 * </ul>
 *
 * <p>개별 소스 실패 / 상세 fetch 실패 / PDF 추출 실패는 전체 크롤을 중단하지 않는다
 * (skip &amp; log 원칙). 상세 수집은 best-effort — 실패 시 목록 정보(제목·날짜)를 유지한다.
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

    /**
     * toEntity 에서 사용하는 정렬 순서 기본값.
     * 크롤된 아이템은 publishedDate 로 정렬하므로 sortOrder 는 0 고정.
     */
    private static final int DEFAULT_SORT_ORDER = 0;

    /**
     * SSRF 방어: fetch 를 허용하는 외부 호스트 허용 목록.
     *
     * <p>상세 페이지 fetch 와 PDF 다운로드 URL 모두 이 목록에 속한 호스트만 허용한다.
     * 목록 외 호스트는 skip &amp; log 처리한다.
     */
    private static final Set<String> ALLOWED_FETCH_HOSTS = Set.of("www.kisa.or.kr");

    /**
     * content 최대 저장 길이 (본문 + PDF 텍스트 합산).
     * RAG 임베딩 토큰 한도를 고려한 실용적 상한 — 매직 넘버 방지.
     * 초과 시 앞 N자로 truncate 한다.
     */
    static final int CONTENT_MAX_LEN = 50_000;

    /** 본문과 PDF 텍스트를 구분하는 구분자. */
    private static final String PDF_SEPARATOR = "\n\n[첨부 PDF]\n";

    private final FeedHtmlFetcher htmlFetcher;
    /** DIP: 목록 파싱은 FeedHtmlParser 인터페이스에 의존한다. */
    private final FeedHtmlParser kisaListParser;
    /** DIP: 상세 파싱은 FeedDetailHtmlParser 인터페이스에 의존한다. */
    private final FeedDetailHtmlParser kisaDetailParser;
    /** DIP: PDF 추출은 PdfTextExtractor 인터페이스에 의존한다. */
    private final PdfTextExtractor pdfTextExtractor;
    private final ComplianceFeedItemRepository repository;
    private final ObjectMapper objectMapper;

    /**
     * 모든 등록 소스를 크롤링하고 신규 아이템을 저장한다.
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
                new FeedSource(FeedSource.KISA_BOARD_URL, kisaListParser, kisaDetailParser)
        );
    }

    private int[] crawlSource(FeedSource source) {
        String html = htmlFetcher.fetch(source.url());
        if (html == null || html.isBlank()) {
            log.warn("[compliance-crawler] HTML fetch 결과 없음 — 스킵 url={}", source.url());
            return new int[]{0, 0};
        }

        List<CrawledFeedItemDto> items = source.listParser().parse(html);
        log.info("[compliance-crawler] 목록 파싱 완료 url={} items={}", source.url(), items.size());

        int saved = 0, skipped = 0;
        for (CrawledFeedItemDto dto : items) {
            CrawledFeedItemDto enriched = enrichWithDetail(dto, source);
            if (saveOrSkip(enriched)) {
                saved++;
            } else {
                skipped++;
            }
        }
        return new int[]{saved, skipped};
    }

    /**
     * 상세 페이지 fetch → 본문 파싱 → PDF 텍스트 추출을 거쳐 content 를 채운다.
     *
     * <p>best-effort: 어느 단계든 실패하면 원본 dto (content=null) 를 그대로 반환한다.
     * 목록 수준 정보(제목·날짜·첨부 메타)는 반드시 보존된다.
     */
    private CrawledFeedItemDto enrichWithDetail(CrawledFeedItemDto dto, FeedSource source) {
        if (dto.sourceUrl() == null || dto.sourceUrl().isBlank()) {
            return dto;
        }
        if (!isAllowedHost(dto.sourceUrl())) {
            log.warn("[compliance-crawler] 허용 외 호스트 — 상세 fetch 스킵 url={}", dto.sourceUrl());
            return dto;
        }
        try {
            String detailHtml = htmlFetcher.fetch(dto.sourceUrl());
            if (detailHtml == null || detailHtml.isBlank()) {
                log.warn("[compliance-crawler] 상세 페이지 fetch 결과 없음 — content=null url={}", dto.sourceUrl());
                return dto;
            }

            DetailFetchResult detail = source.detailParser().parseDetail(detailHtml);
            String pdfText = extractAllPdfText(detail.pdfDownloadUrls());
            String content = assembleContent(detail.bodyText(), pdfText);

            return withContent(dto, content);
        } catch (Exception e) {
            log.warn("[compliance-crawler] 상세 수집 실패 — content=null 유지 url={} cause={}", dto.sourceUrl(), e.getMessage());
            return dto;
        }
    }

    /**
     * PDF URL 목록에서 텍스트를 추출해 합친다.
     *
     * <p>개별 PDF 실패는 skip &amp; log — 다른 PDF 는 계속 처리한다.
     */
    private String extractAllPdfText(List<String> pdfUrls) {
        if (pdfUrls == null || pdfUrls.isEmpty()) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        for (String url : pdfUrls) {
            appendPdfText(sb, url);
        }
        return sb.toString();
    }

    private void appendPdfText(StringBuilder sb, String url) {
        if (!isAllowedHost(url)) {
            log.warn("[compliance-crawler] 허용 외 호스트 — PDF fetch 스킵 url={}", url);
            return;
        }
        try {
            byte[] bytes = htmlFetcher.fetchBytes(url);
            if (bytes == null || bytes.length == 0) {
                log.warn("[compliance-crawler] PDF 바이트 없음 url={}", url);
                return;
            }
            String text = pdfTextExtractor.extract(bytes);
            if (text != null && !text.isBlank()) {
                if (sb.length() > 0) {
                    sb.append(PDF_SEPARATOR);
                }
                sb.append(text);
            }
        } catch (Exception e) {
            // PDF URL 만 기록 — 바이너리 내용은 로그에 출력하지 않는다
            log.warn("[compliance-crawler] PDF 텍스트 추출 실패 url={} cause={}", url, e.getMessage());
        }
    }

    /**
     * 본문 텍스트와 PDF 텍스트를 합쳐 content 를 조립한다.
     *
     * <p>두 값 모두 없으면 null 반환 (content=null 유지).
     * {@value #CONTENT_MAX_LEN}자 초과 시 앞 N자로 truncate.
     */
    private String assembleContent(String bodyText, String pdfText) {
        boolean hasBody = bodyText != null && !bodyText.isBlank();
        boolean hasPdf  = pdfText  != null && !pdfText.isBlank();

        if (!hasBody && !hasPdf) {
            return null;
        }

        String combined;
        if (hasBody && hasPdf) {
            combined = bodyText + PDF_SEPARATOR + pdfText;
        } else if (hasBody) {
            combined = bodyText;
        } else {
            combined = pdfText;
        }

        return combined.length() <= CONTENT_MAX_LEN ? combined : combined.substring(0, CONTENT_MAX_LEN);
    }

    private boolean saveOrSkip(CrawledFeedItemDto dto) {
        String hash = computeContentHash(dto);
        if (hash != null && repository.existsByContentHash(hash)) {
            return false;
        }
        repository.save(toEntity(dto, hash));
        return true;
    }

    /**
     * contentHash = SHA-256(sourceUrl + preview).
     *
     * <p>preview = summary 앞 {@value #HASH_PREVIEW_LEN}자.
     * summary 가 null 이면 content 앞 {@value #HASH_PREVIEW_LEN}자로 대체.
     * sourceUrl 이 없으면 null — 저장은 허용하되 dedup 미적용.
     */
    private String computeContentHash(CrawledFeedItemDto dto) {
        if (dto.sourceUrl() == null || dto.sourceUrl().isBlank()) {
            return null;
        }
        return sha256(dto.sourceUrl() + buildPreview(dto));
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
                .sortOrder(DEFAULT_SORT_ORDER)
                .build();
    }

    /** record 는 immutable 이므로 content 만 교체한 새 인스턴스를 생성한다. */
    private CrawledFeedItemDto withContent(CrawledFeedItemDto dto, String content) {
        return new CrawledFeedItemDto(
                dto.title(), dto.summary(), dto.sourceUrl(), dto.publishedDate(),
                content, dto.files(), dto.agency(), dto.category(), dto.source()
        );
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

    /**
     * URL 의 호스트가 {@link #ALLOWED_FETCH_HOSTS} 에 포함되는지 검사한다 (SSRF 방어).
     *
     * <p>파싱 실패·null 호스트는 허용하지 않는다 (보수적 방어).
     */
    private boolean isAllowedHost(String url) {
        try {
            String host = URI.create(url).getHost();
            return host != null && ALLOWED_FETCH_HOSTS.contains(host.toLowerCase(java.util.Locale.ROOT));
        } catch (Exception e) {
            log.warn("[compliance-crawler] URL 파싱 실패 — SSRF 방어로 스킵 url={}", url);
            return false;
        }
    }

    private String sha256(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            log.error("[compliance-crawler] SHA-256 계산 실패: {}", e.getMessage());
            return null;
        }
    }
}
