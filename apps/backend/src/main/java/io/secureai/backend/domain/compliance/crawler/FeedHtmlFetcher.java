package io.secureai.backend.domain.compliance.crawler;

/**
 * 외부 URL 에서 HTML 을 가져오는 fetcher 인터페이스.
 *
 * <p>네트워크 레이어와 파싱 레이어를 분리한다.
 * 실제 구현체({@link WebClientFeedHtmlFetcher})는 RestClient 를 사용하고,
 * 테스트 대역(stub/mock)은 픽스처 HTML 을 반환해 네트워크 없이 파서를 검증할 수 있다.
 *
 * <p>반환값이 null 이거나 빈 문자열이면 파싱 단계에서 skip & log 처리한다.
 */
public interface FeedHtmlFetcher {

    /**
     * 주어진 URL 의 HTML 본문을 문자열로 반환한다.
     *
     * @param url 크롤링 대상 URL
     * @return HTML 문자열. 오류 시 null 반환 (예외 전파 금지 — skip & log 처리)
     */
    String fetch(String url);
}
