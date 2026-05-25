package io.secureai.backend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

/**
 * GitHub API 호출용 RestClient 빈 등록.
 *
 * CommitHistoryScanner, GitHubRestClient 등이 생성자 주입으로 사용한다 (DIP).
 * HTTP 연결 타임아웃 설정은 이 클래스에서만 관리한다 (SRP).
 */
@Configuration
public class GitHubRestClientConfig {

    private static final String GITHUB_API_BASE = "https://api.github.com";
    private static final int CONNECT_TIMEOUT_MS = 10_000;
    private static final int READ_TIMEOUT_MS = 30_000;

    @Bean(name = "githubRestClient")
    public RestClient githubRestClient() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(CONNECT_TIMEOUT_MS);
        factory.setReadTimeout(READ_TIMEOUT_MS);
        return RestClient.builder()
                .requestFactory(factory)
                .baseUrl(GITHUB_API_BASE)
                .defaultHeader("Accept", "application/vnd.github.v3+json")
                .defaultHeader("User-Agent", "secureai-backend/1.0")
                .build();
    }
}
