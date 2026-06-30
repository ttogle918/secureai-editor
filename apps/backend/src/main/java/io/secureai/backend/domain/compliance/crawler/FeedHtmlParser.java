package io.secureai.backend.domain.compliance.crawler;

import io.secureai.backend.domain.compliance.crawler.dto.CrawledFeedItemDto;

import java.util.List;

/**
 * 기관 게시판 HTML 을 파싱하는 파서 인터페이스.
 *
 * <p>사이트별로 HTML 구조가 다르므로 Strategy 패턴으로 확장 가능하게 설계한다.
 * 구현체는 네트워크 의존 없이 HTML 문자열만 입력받아 아이템 목록을 반환한다
 * (순수 함수로 단위 테스트 가능).
 *
 * <p>규칙:
 * <ul>
 *   <li>빈 HTML 이나 파싱 실패 시 빈 목록을 반환한다 (예외 전파 금지 — skip &amp; log).</li>
 *   <li>개별 행 파싱 오류 시 해당 행만 skip 하고 나머지를 계속 처리한다.</li>
 *   <li>외부 콘텐츠 원문 전체 복제 금지 — summary 요약만 허용.</li>
 * </ul>
 */
public interface FeedHtmlParser {

    /**
     * HTML 게시판 페이지를 파싱해 아이템 목록을 반환한다.
     *
     * @param html 게시판 목록 페이지 HTML 원문
     * @return 추출된 피드 아이템 목록. 파싱 불가 시 빈 목록.
     */
    List<CrawledFeedItemDto> parse(String html);

    /** 이 파서가 담당하는 기관명 (로그·메타 필드에 사용). */
    String getAgency();

    /** 이 파서가 담당하는 카테고리 (로그·메타 필드에 사용). */
    String getCategory();

    /** 이 파서가 담당하는 소스명 (로그·메타 필드에 사용). */
    String getSource();
}
