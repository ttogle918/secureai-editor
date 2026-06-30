package io.secureai.backend.domain.compliance.crawler;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * RestClient 기반 HTML fetcher 구현체.
 *
 * <p>NvdApiClient 의 RestClient 사용 패턴을 따른다.
 * 네트워크 오류 발생 시 예외를 잡아 null 을 반환하며 호출자에서 skip & log 한다.
 * 민감 정보를 다루지 않으므로 타임아웃·에러 메시지 로그는 URL 수준까지만 기록한다.
 */
@Slf4j
@Component
public class WebClientFeedHtmlFetcher implements FeedHtmlFetcher {

    private static final int CONNECT_TIMEOUT_MS = 10_000;
    private static final int READ_TIMEOUT_MS = 30_000;

    /** 일반 브라우저 User-Agent 를 설정해 공공 사이트 차단을 방지한다. */
    private static final String USER_AGENT =
            "Mozilla/5.0 (compatible; SecureAI-Crawler/1.0; +https://secureai.io/crawler)";

    private final RestClient restClient;

    public WebClientFeedHtmlFetcher() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(CONNECT_TIMEOUT_MS);
        factory.setReadTimeout(READ_TIMEOUT_MS);
        this.restClient = RestClient.builder()
                .requestFactory(factory)
                .defaultHeader("User-Agent", USER_AGENT)
                .build();
    }

    @Override
    public String fetch(String url) {
        try {
            return restClient.get()
                    .uri(url)
                    .retrieve()
                    .body(String.class);
        } catch (Exception e) {
            log.warn("[compliance-crawler] HTML fetch 실패 url={} cause={}", url, e.getMessage());
            return null;
        }
    }

    @Override
    public byte[] fetchBytes(String url) {
        try {
            return restClient.get()
                    .uri(url)
                    .retrieve()
                    .body(byte[].class);
        } catch (Exception e) {
            // PDF 다운로드 실패 — URL 만 기록, 바이너리 내용은 로그에 출력하지 않는다
            log.warn("[compliance-crawler] 바이너리 fetch 실패 url={} cause={}", url, e.getMessage());
            return null;
        }
    }
}
