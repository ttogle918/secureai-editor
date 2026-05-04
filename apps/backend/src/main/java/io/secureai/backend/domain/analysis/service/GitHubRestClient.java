package io.secureai.backend.domain.analysis.service;

import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * GitHub REST API HTTP 클라이언트.
 *
 * 레포지토리 접근 가능 여부를 검증하는 단일 책임을 가진다(SRP).
 * 비즈니스 로직(토큰 복호화, URL 파싱)은 GitHubApiService가 담당한다.
 */
@Slf4j
@Component
public class GitHubRestClient {

    private static final String GITHUB_API_BASE = "https://api.github.com";

    private final RestClient restClient;

    public GitHubRestClient() {
        this.restClient = RestClient.builder()
                .baseUrl(GITHUB_API_BASE)
                .defaultHeader("Accept", "application/vnd.github.v3+json")
                .defaultHeader("User-Agent", "secureai-backend/1.0")
                .build();
    }

    /**
     * GitHub 레포지토리에 대한 읽기 접근 가능 여부를 검증한다.
     *
     * @param owner GitHub 레포지토리 소유자
     * @param repo  레포지토리 이름
     * @param token 복호화된 GitHub 개인 접근 토큰 (null이면 공개 레포로 시도)
     * @throws BusinessException GITHUB_AUTH_REQUIRED — 403 응답 (권한 부족)
     * @throws BusinessException GITHUB_REPO_NOT_FOUND — 404 응답 (레포 없음)
     * @throws BusinessException GITHUB_RATE_LIMIT_EXCEEDED — 429 또는 rate limit 초과
     */
    public void validateRepoAccess(String owner, String repo, String token) {
        // 토큰은 로그에 절대 출력 금지
        log.info("[github-client] validateRepoAccess owner={} repo={}", owner, repo);

        try {
            restClient.get()
                    .uri("/repos/{owner}/{repo}", owner, repo)
                    .headers(headers -> {
                        if (token != null) {
                            headers.set("Authorization", "Bearer " + token);
                        }
                    })
                    .retrieve()
                    .onStatus(HttpStatusCode::is4xxClientError, (request, response) -> {
                        int statusCode = response.getStatusCode().value();
                        if (statusCode == 403) {
                            throw new BusinessException(ErrorCode.GITHUB_AUTH_REQUIRED);
                        } else if (statusCode == 404) {
                            throw new BusinessException(ErrorCode.GITHUB_REPO_NOT_FOUND);
                        } else if (statusCode == 429) {
                            throw new BusinessException(ErrorCode.GITHUB_RATE_LIMIT_EXCEEDED);
                        }
                        throw new BusinessException(ErrorCode.GITHUB_AUTH_REQUIRED);
                    })
                    .toBodilessEntity();

            log.info("[github-client] repo accessible owner={} repo={}", owner, repo);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.warn("[github-client] validateRepoAccess failed owner={} repo={} err={}",
                    owner, repo, e.getMessage());
            // rate limit 헤더 응답 처리 (x-ratelimit-remaining: 0)
            if (e.getMessage() != null && e.getMessage().contains("ratelimit")) {
                throw new BusinessException(ErrorCode.GITHUB_RATE_LIMIT_EXCEEDED);
            }
            throw new BusinessException(ErrorCode.GITHUB_REPO_NOT_FOUND);
        }
    }
}
