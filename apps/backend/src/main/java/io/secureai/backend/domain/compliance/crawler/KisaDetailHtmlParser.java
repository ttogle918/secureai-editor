package io.secureai.backend.domain.compliance.crawler;

import io.secureai.backend.domain.compliance.crawler.dto.DetailFetchResult;
import lombok.extern.slf4j.Slf4j;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * KISA 보안취약점/침해사고 자료실 게시물 상세 페이지 파서.
 *
 * <p>대상 URL 형식: https://www.kisa.or.kr/2060204/form?postSeq={N}&page=1
 * KISA 상세 페이지는 {@code div.view-con} 에 본문을 담고,
 * {@code ul.file-list} 또는 {@code div.file-box} 에 첨부파일 다운로드 링크를 담는다.
 *
 * <p>본문 정제: 스크립트·스타일 태그를 제거 후 텍스트를 추출하고 연속 공백을 정리한다.
 * RAG 임베딩 내부용 — 프론트엔드 노출 없음(표시는 summary + source_url 링크).
 *
 * <p>파싱 실패 시 {@link DetailFetchResult#empty()} 반환 (예외 전파 금지 — skip &amp; log).
 */
@Slf4j
@Component
public class KisaDetailHtmlParser implements FeedDetailHtmlParser {

    private static final String BASE_URL = "https://www.kisa.or.kr";

    /** PDF 판별 파일 확장자 (대소문자 무관). */
    private static final String PDF_EXTENSION = ".pdf";

    @Override
    public DetailFetchResult parseDetail(String html) {
        if (html == null || html.isBlank()) {
            log.warn("[kisa-detail-parser] HTML 이 비어 있어 파싱 스킵");
            return DetailFetchResult.empty();
        }

        try {
            Document doc = Jsoup.parse(html, BASE_URL);
            String bodyText = extractBodyText(doc);
            List<String> pdfUrls = extractPdfDownloadUrls(doc);
            return new DetailFetchResult(bodyText, pdfUrls);
        } catch (Exception e) {
            log.warn("[kisa-detail-parser] 파싱 실패 — empty 반환: {}", e.getMessage());
            return DetailFetchResult.empty();
        }
    }

    /**
     * 본문 텍스트를 추출한다.
     *
     * <p>스크립트·스타일 노드를 제거하고 공백을 정리한다.
     * {@code div.view-con} → {@code div.con} → {@code div.board-view} 순으로 fallback.
     */
    private String extractBodyText(Document doc) {
        Element body = selectBodyElement(doc);
        if (body == null) {
            log.warn("[kisa-detail-parser] 본문 요소를 찾지 못함 — 빈 문자열 반환");
            return "";
        }

        // 스크립트·스타일·네비 태그 제거 (불필요한 노이즈 제거)
        body.select("script, style, nav, header, footer").remove();

        return normalizeWhitespace(body.text());
    }

    private Element selectBodyElement(Document doc) {
        // 우선순위 순으로 KISA 상세 페이지 본문 요소를 탐색한다
        for (String selector : List.of("div.view-con", "div.con", "td.view-con", "div.board-view")) {
            Element el = doc.selectFirst(selector);
            if (el != null) {
                return el;
            }
        }
        return null;
    }

    /**
     * PDF 첨부 다운로드 절대 URL 목록을 추출한다.
     *
     * <p>파일 확장자가 {@code .pdf} 인 링크만 수집한다.
     * Jsoup {@code abs:href} 속성으로 절대 URL 로 변환한다.
     */
    private List<String> extractPdfDownloadUrls(Document doc) {
        List<String> urls = new ArrayList<>();
        // KISA 상세 페이지의 첨부파일 영역 — 여러 패턴을 커버한다
        Elements links = doc.select("ul.file-list a, div.file-box a, div.file-down a, ul li a[href*=fileDownload]");

        for (Element link : links) {
            String href = link.attr("abs:href");
            if (href.isBlank()) {
                continue;
            }
            // PDF 파일만 다운로드 대상으로 한정한다
            if (isPdfLink(href)) {
                urls.add(href);
            }
        }
        return urls;
    }

    /**
     * href 만으로 PDF 링크 여부를 판별한다.
     *
     * <p>링크 텍스트(linkText)는 사용하지 않는다.
     * 링크 텍스트로 판별하면 공격자가 "xxx.pdf" 텍스트로 HWP/악성 URL 을 속일 수 있다
     * (SSRF 방어 — href-only 판별).
     */
    private boolean isPdfLink(String href) {
        String lowerHref = href.toLowerCase();
        return lowerHref.contains(PDF_EXTENSION);
    }

    /** 연속 공백·개행을 단일 공백으로 정규화한다. */
    private String normalizeWhitespace(String text) {
        if (text == null) {
            return "";
        }
        return text.replaceAll("\\s+", " ").trim();
    }
}
