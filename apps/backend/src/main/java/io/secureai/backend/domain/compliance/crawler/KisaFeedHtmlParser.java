package io.secureai.backend.domain.compliance.crawler;

import io.secureai.backend.domain.compliance.crawler.dto.CrawledFeedItemDto;
import lombok.extern.slf4j.Slf4j;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * KISA 보안취약점/침해사고 자료실 게시판 HTML 파서.
 *
 * <p>대상 URL: https://www.kisa.or.kr/2060204/form
 * KISA 게시판은 {@code .tbl_list} 테이블 내 {@code tbody tr} 구조를 사용한다.
 * 컬럼 순서: [번호, 제목+첨부링크, 등록일, 첨부파일]
 *
 * <p>외부 콘텐츠 원문 전체 복제 금지 — 제목을 summary 로도 활용하며, 원문은 sourceUrl 링크.
 * 개별 행 파싱 오류는 해당 행을 skip &amp; log 하고 계속 처리한다.
 */
@Slf4j
@Component
public class KisaFeedHtmlParser implements FeedHtmlParser {

    static final String AGENCY   = "KISA";
    static final String CATEGORY = "보안취약점·침해사고 대응";
    static final String SOURCE   = "KISA";

    /** 게시판 베이스 URL — 상대 경로 href 를 절대 URL 로 변환할 때 사용한다. */
    private static final String BASE_URL = "https://www.kisa.or.kr";

    /** KISA 게시판 등록일 형식 (예: 2026.06.24). */
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyy.MM.dd");

    /** 제목 최대 저장 길이 — 엔티티 컬럼 제약 500자 이내. */
    private static final int TITLE_MAX_LEN = 500;

    /**
     * 첨부파일 링크 텍스트 중 실제 파일명이 아닌 범용 레이블 목록.
     * 이 값들은 files 목록에서 제외한다.
     */
    private static final Set<String> IGNORED_FILE_LABELS = Set.of("첨부파일", "-");

    @Override
    public List<CrawledFeedItemDto> parse(String html) {
        if (html == null || html.isBlank()) {
            log.warn("[kisa-parser] HTML 이 비어 있어 파싱 스킵");
            return List.of();
        }

        Document doc = Jsoup.parse(html, BASE_URL);
        Elements rows = doc.select("table.tbl_list tbody tr");

        if (rows.isEmpty()) {
            log.warn("[kisa-parser] 게시판 행을 찾지 못함 (tbody tr 없음) — 사이트 구조 변경 확인 필요");
            return List.of();
        }

        List<CrawledFeedItemDto> result = new ArrayList<>();
        for (Element row : rows) {
            CrawledFeedItemDto item = parseRow(row);
            if (item != null) {
                result.add(item);
            }
        }
        return result;
    }

    /**
     * 단일 게시판 행을 파싱한다.
     *
     * @return 파싱 성공 시 DTO, 실패 시 null (호출자가 skip 처리)
     */
    private CrawledFeedItemDto parseRow(Element row) {
        try {
            String title     = extractTitle(row);
            String sourceUrl = extractSourceUrl(row);
            LocalDate date   = extractDate(row);
            List<CrawledFeedItemDto.FileMetaDto> files = extractFiles(row);

            if (title == null || title.isBlank()) {
                log.warn("[kisa-parser] 제목 없는 행 스킵");
                return null;
            }

            // 원문 전체 복제 금지 — 제목을 summary 로 활용, content 는 null
            String summary = truncate(title, TITLE_MAX_LEN);

            return new CrawledFeedItemDto(
                    truncate(title, TITLE_MAX_LEN),
                    summary,
                    sourceUrl,
                    date,
                    null,   // 개별 게시물 페이지 방문 없이 목록만 수집 — 원문 복제 금지
                    files,
                    AGENCY,
                    CATEGORY,
                    SOURCE
            );
        } catch (Exception e) {
            log.warn("[kisa-parser] 행 파싱 실패 — 스킵: {}", e.getMessage());
            return null;
        }
    }

    private String extractTitle(Element row) {
        Element anchor = row.selectFirst("td.title a");
        if (anchor == null) {
            anchor = row.selectFirst("td:nth-child(2) a");
        }
        return anchor != null ? anchor.text().trim() : null;
    }

    private String extractSourceUrl(Element row) {
        Element anchor = row.selectFirst("td.title a");
        if (anchor == null) {
            anchor = row.selectFirst("td:nth-child(2) a");
        }
        if (anchor == null) {
            return null;
        }
        String href = anchor.attr("abs:href");
        return href.isBlank() ? null : href;
    }

    private LocalDate extractDate(Element row) {
        Element dateCell = row.selectFirst("td.date");
        if (dateCell == null) {
            dateCell = row.selectFirst("td:nth-child(3)");
        }
        if (dateCell == null) {
            return null;
        }
        String text = dateCell.text().trim();
        return parseDate(text);
    }

    private List<CrawledFeedItemDto.FileMetaDto> extractFiles(Element row) {
        List<CrawledFeedItemDto.FileMetaDto> files = new ArrayList<>();
        // 첨부 링크는 td.title 내 span.icon_file > a 또는 td.file > a 에서 수집
        Elements fileLinks = row.select("td.title span.icon_file a, td.file a");
        for (Element link : fileLinks) {
            String name = link.text().trim();
            if (name.isBlank() || IGNORED_FILE_LABELS.contains(name)) {
                // 실제 파일명이 아닌 범용 레이블(IGNORED_FILE_LABELS) 제외
                continue;
            }
            String type = deriveFileType(name);
            files.add(new CrawledFeedItemDto.FileMetaDto(name, type, null));
        }
        return files;
    }

    private LocalDate parseDate(String text) {
        try {
            return LocalDate.parse(text, DATE_FMT);
        } catch (DateTimeParseException e) {
            log.warn("[kisa-parser] 날짜 파싱 실패 text='{}': {}", text, e.getMessage());
            return null;
        }
    }

    /** 파일 확장자로 타입을 유추한다. */
    private String deriveFileType(String filename) {
        int dot = filename.lastIndexOf('.');
        if (dot < 0 || dot == filename.length() - 1) {
            return "FILE";
        }
        return filename.substring(dot + 1).toUpperCase();
    }

    private String truncate(String value, int maxLen) {
        if (value == null) {
            return null;
        }
        return value.length() <= maxLen ? value : value.substring(0, maxLen);
    }

    @Override
    public String getAgency()   { return AGENCY; }

    @Override
    public String getCategory() { return CATEGORY; }

    @Override
    public String getSource()   { return SOURCE; }
}
