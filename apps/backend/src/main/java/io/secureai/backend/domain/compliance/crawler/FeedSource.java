package io.secureai.backend.domain.compliance.crawler;

/**
 * 크롤링 대상 소스 정의.
 *
 * <p>URL 매직 스트링을 방지하고, 소스 확장 시 이 레코드에 추가만 하면 된다.
 * 실제 소스 목록은 {@link ComplianceFeedCrawler} 에서 주입받아 관리한다.
 *
 * @param url          크롤링 대상 게시판 목록 페이지 URL
 * @param listParser   목록 페이지 HTML 파서 (아이템 목록 추출)
 * @param detailParser 상세 페이지 HTML 파서 (본문 + PDF URL 추출, Stage C)
 */
public record FeedSource(String url, FeedHtmlParser listParser, FeedDetailHtmlParser detailParser) {

    /** KISA 보안취약점/침해사고 자료실 게시판 목록 URL. */
    public static final String KISA_BOARD_URL = "https://www.kisa.or.kr/2060204/form";
}
