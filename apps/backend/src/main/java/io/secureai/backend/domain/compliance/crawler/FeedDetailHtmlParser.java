package io.secureai.backend.domain.compliance.crawler;

import io.secureai.backend.domain.compliance.crawler.dto.DetailFetchResult;

/**
 * 게시물 상세 페이지 HTML 파서 인터페이스.
 *
 * <p>사이트별로 HTML 구조가 다르므로 Strategy 패턴으로 확장 가능하게 설계한다.
 * 구현체는 네트워크 의존 없이 HTML 문자열만 입력받아 본문과 PDF URL 을 반환한다
 * (순수 함수로 단위 테스트 가능).
 *
 * <p>규칙:
 * <ul>
 *   <li>파싱 실패 시 {@link DetailFetchResult#empty()} 를 반환한다 (예외 전파 금지 — skip &amp; log).</li>
 *   <li>스크립트·스타일·네비게이션 요소를 제거하고 순수 텍스트를 반환한다.</li>
 *   <li>PDF 다운로드 URL 은 절대 URL 로 변환해 반환한다.</li>
 * </ul>
 */
public interface FeedDetailHtmlParser {

    /**
     * 게시물 상세 페이지 HTML 을 파싱해 본문 텍스트와 PDF 다운로드 URL 을 반환한다.
     *
     * @param html 상세 페이지 HTML 원문
     * @return 파싱 결과. 실패 시 {@link DetailFetchResult#empty()}.
     */
    DetailFetchResult parseDetail(String html);
}
