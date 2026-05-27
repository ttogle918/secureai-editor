package io.secureai.backend.domain.analysis.service;

import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * GitHub REST API HTTP 클라이언트.
 *
 * 책임:
 * 1. 레포지토리 접근 가능 여부 검증
 * 2. Check Run 생성 및 완료 업데이트
 * 3. PR 코멘트 작성
 * 4. PR 변경 파일 목록 조회
 *
 * HTTP 클라이언트 구성(타임아웃, baseUrl 등)은 GitHubRestClientConfig에서만 관리한다 (SRP).
 * appToken, token은 절대 로그에 출력하지 않는다.
 */
@Slf4j
@Component
public class GitHubRestClient {

    private static final String CHECK_RUN_NAME = "SecureAI Security Review";

    private final RestClient restClient;

    public GitHubRestClient(@Qualifier("githubRestClient") RestClient restClient) {
        this.restClient = restClient;
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
            if (e.getMessage() != null && e.getMessage().contains("ratelimit")) {
                throw new BusinessException(ErrorCode.GITHUB_RATE_LIMIT_EXCEEDED);
            }
            throw new BusinessException(ErrorCode.GITHUB_REPO_NOT_FOUND);
        }
    }

    /**
     * GitHub Check Run을 지정한 상태로 생성한다.
     *
     * @param owner    레포지토리 소유자
     * @param repo     레포지토리 이름
     * @param sha      HEAD 커밋 SHA
     * @param name     Check Run 이름 (null/blank이면 기본값 사용)
     * @param status   Check Run 상태 ("in_progress" 등)
     * @param appToken Installation Token (로그 출력 금지)
     * @return 생성된 Check Run 응답 (id 포함)
     */
    @SuppressWarnings("unchecked")
    public CheckRunResponse createCheckRun(String owner, String repo, String sha,
                                           String name, String status, String appToken) {
        // appToken 로그 출력 금지
        String checkRunName = (name != null && !name.isBlank()) ? name : CHECK_RUN_NAME;

        Map<String, Object> body = new HashMap<>();
        body.put("name", checkRunName);
        body.put("head_sha", sha);
        body.put("status", status);

        Map<String, Object> response = restClient.post()
                .uri("/repos/{owner}/{repo}/check-runs", owner, repo)
                .headers(headers -> {
                    headers.setBearerAuth(appToken);
                    headers.set("Accept", "application/vnd.github+json");
                })
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .onStatus(HttpStatusCode::is4xxClientError, (req, res) -> {
                    log.warn("[github-client] Check Run 생성 실패 owner={} repo={} status={}",
                            owner, repo, res.getStatusCode().value());
                    throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR);
                })
                .body(Map.class);

        if (response == null || response.get("id") == null) {
            throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR);
        }

        long checkRunId = ((Number) response.get("id")).longValue();
        log.info("[github-client] Check Run 생성 완료 owner={} repo={} sha={} checkRunId={}",
                owner, repo, sha, checkRunId);
        return new CheckRunResponse(checkRunId);
    }

    /**
     * Check Run을 완료 상태로 업데이트한다.
     *
     * @param owner      레포지토리 소유자
     * @param repo       레포지토리 이름
     * @param checkRunId 완료할 Check Run ID
     * @param conclusion "success" | "failure"
     * @param summary    Check Run 출력 요약 (민감 경로 포함 금지)
     * @param appToken   Installation Token (로그 출력 금지)
     */
    public void completeCheckRun(String owner, String repo, long checkRunId,
                                  String conclusion, String summary, String appToken) {
        // appToken 로그 출력 금지
        Map<String, Object> body = new HashMap<>();
        body.put("status", "completed");
        body.put("conclusion", conclusion);

        Map<String, Object> output = new HashMap<>();
        output.put("title", "SecureAI Security Review 완료");
        output.put("summary", summary);
        body.put("output", output);

        restClient.patch()
                .uri("/repos/{owner}/{repo}/check-runs/{checkRunId}", owner, repo, checkRunId)
                .headers(headers -> {
                    headers.setBearerAuth(appToken);
                    headers.set("Accept", "application/vnd.github+json");
                })
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .onStatus(HttpStatusCode::is4xxClientError, (req, res) -> {
                    log.warn("[github-client] Check Run 완료 업데이트 실패 checkRunId={} status={}",
                            checkRunId, res.getStatusCode().value());
                    throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR);
                })
                .toBodilessEntity();

        log.info("[github-client] Check Run 완료 checkRunId={} conclusion={}", checkRunId, conclusion);
    }

    /**
     * GitHub PR에 코멘트를 작성한다.
     * 보안 규칙: 코멘트 내용에 민감 경로/라인 포함 금지.
     *
     * @param owner    레포지토리 소유자
     * @param repo     레포지토리 이름
     * @param prNumber PR 번호
     * @param body     코멘트 본문 (마크다운, 민감 정보 포함 금지)
     * @param token    GitHub 토큰 (로그 출력 금지)
     * @return GitHub API 응답 맵
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> createPrComment(String owner, String repo,
                                               int prNumber, String body, String token) {
        // token 로그 출력 금지
        Map<String, String> requestBody = new HashMap<>();
        requestBody.put("body", body);

        Map<String, Object> response = restClient.post()
                .uri("/repos/{owner}/{repo}/issues/{prNumber}/comments", owner, repo, prNumber)
                .headers(headers -> headers.setBearerAuth(token))
                .contentType(MediaType.APPLICATION_JSON)
                .body(requestBody)
                .retrieve()
                .onStatus(HttpStatusCode::is4xxClientError, (req, res) -> {
                    log.warn("[github-client] PR 코멘트 생성 실패 pr=#{} status={}",
                            prNumber, res.getStatusCode().value());
                    throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR);
                })
                .body(Map.class);

        log.info("[github-client] PR 코멘트 생성 완료 pr=#{} owner={} repo={}", prNumber, owner, repo);
        return response;
    }

    /**
     * PR의 변경된 파일 목록(filename만)을 조회한다.
     *
     * @param owner    레포지토리 소유자
     * @param repo     레포지토리 이름
     * @param prNumber PR 번호
     * @param token    GitHub 토큰 (로그 출력 금지)
     * @return 변경된 파일 경로 목록 (빈 리스트 가능)
     */
    @SuppressWarnings("unchecked")
    public List<String> getPrChangedFiles(String owner, String repo, int prNumber, String token) {
        // token 로그 출력 금지
        List<Map<String, Object>> files = restClient.get()
                .uri("/repos/{owner}/{repo}/pulls/{prNumber}/files", owner, repo, prNumber)
                .headers(headers -> {
                    if (token != null && !token.isBlank()) {
                        headers.setBearerAuth(token);
                    }
                })
                .retrieve()
                .onStatus(HttpStatusCode::is4xxClientError, (req, res) -> {
                    log.warn("[github-client] PR 변경 파일 조회 실패 pr=#{} status={}",
                            prNumber, res.getStatusCode().value());
                    throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR);
                })
                .body(List.class);

        if (files == null) {
            return List.of();
        }

        return files.stream()
                .map(file -> (String) file.get("filename"))
                .filter(filename -> filename != null && !filename.isBlank())
                .toList();
    }

    // ─── Inner DTOs ──────────────────────────────────────────────────────────

    /**
     * Check Run 생성 응답 DTO.
     */
    public record CheckRunResponse(long id) {}
}
