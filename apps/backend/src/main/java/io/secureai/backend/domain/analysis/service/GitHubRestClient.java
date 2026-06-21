package io.secureai.backend.domain.analysis.service;

import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
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

    /**
     * 레포지토리 기본 브랜치의 최신 커밋 SHA를 조회한다.
     *
     * @param owner     레포지토리 소유자
     * @param repo      레포지토리 이름
     * @param branch    기준 브랜치명 (null/blank이면 기본 브랜치 조회 후 SHA 반환)
     * @param appToken  Installation Token (로그 출력 금지)
     * @return 브랜치 HEAD 커밋 SHA (40자 hex)
     */
    @SuppressWarnings("unchecked")
    public String getDefaultBranchSha(String owner, String repo, String branch, String appToken) {
        // appToken 로그 출력 금지
        String targetBranch = (branch != null && !branch.isBlank()) ? branch : resolveDefaultBranch(owner, repo, appToken);

        Map<String, Object> response = restClient.get()
                .uri("/repos/{owner}/{repo}/git/ref/heads/{branch}", owner, repo, targetBranch)
                .headers(headers -> {
                    headers.setBearerAuth(appToken);
                    headers.set("Accept", "application/vnd.github+json");
                })
                .retrieve()
                .onStatus(HttpStatusCode::is4xxClientError, (req, res) -> {
                    int statusCode = res.getStatusCode().value();
                    log.warn("[github-client] HEAD SHA 조회 실패 owner={} repo={} branch={} status={}",
                            owner, repo, targetBranch, statusCode);
                    if (statusCode == 403) throw new BusinessException(ErrorCode.GITHUB_AUTH_REQUIRED);
                    if (statusCode == 429) throw new BusinessException(ErrorCode.GITHUB_RATE_LIMIT_EXCEEDED);
                    throw new BusinessException(ErrorCode.GITHUB_REPO_NOT_FOUND);
                })
                .body(Map.class);

        if (response == null) {
            throw new BusinessException(ErrorCode.GITHUB_REPO_NOT_FOUND);
        }

        Map<String, Object> object = (Map<String, Object>) response.get("object");
        if (object == null || object.get("sha") == null) {
            throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR);
        }
        String sha = (String) object.get("sha");
        log.info("[github-client] HEAD SHA 조회 완료 owner={} repo={} branch={}", owner, repo, targetBranch);
        return sha;
    }

    /**
     * 새 브랜치 ref를 생성한다.
     * 이미 존재하면 PATCH_BRANCH_CONFLICT 예외를 발생시킨다.
     *
     * @param owner      레포지토리 소유자
     * @param repo       레포지토리 이름
     * @param branchName 생성할 브랜치명 (예: "secureai/patch-abc123")
     * @param sha        기준 커밋 SHA (base HEAD)
     * @param appToken   Installation Token (로그 출력 금지)
     */
    public void createBranchRef(String owner, String repo, String branchName, String sha, String appToken) {
        // appToken 로그 출력 금지
        Map<String, Object> body = new HashMap<>();
        body.put("ref", "refs/heads/" + branchName);
        body.put("sha", sha);

        restClient.post()
                .uri("/repos/{owner}/{repo}/git/refs", owner, repo)
                .headers(headers -> {
                    headers.setBearerAuth(appToken);
                    headers.set("Accept", "application/vnd.github+json");
                })
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .onStatus(HttpStatusCode::is4xxClientError, (req, res) -> {
                    int statusCode = res.getStatusCode().value();
                    log.warn("[github-client] 브랜치 ref 생성 실패 owner={} repo={} branch={} status={}",
                            owner, repo, branchName, statusCode);
                    if (statusCode == 422) throw new BusinessException(ErrorCode.PATCH_BRANCH_CONFLICT);
                    if (statusCode == 403) throw new BusinessException(ErrorCode.GITHUB_AUTH_REQUIRED);
                    if (statusCode == 429) throw new BusinessException(ErrorCode.GITHUB_RATE_LIMIT_EXCEEDED);
                    throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR);
                })
                .toBodilessEntity();

        log.info("[github-client] 브랜치 ref 생성 완료 owner={} repo={} branch={}", owner, repo, branchName);
    }

    /**
     * 파일을 브랜치에 커밋한다 (신규 파일 create / 기존 파일 update).
     * 기존 파일 업데이트 시 fileSha가 반드시 필요하다 (GitHub API 요구사항).
     *
     * @param owner      레포지토리 소유자
     * @param repo       레포지토리 이름
     * @param filePath   파일 경로 (레포 루트 기준, 예: "src/main/java/Dao.java")
     * @param message    커밋 메시지 (민감 경로/페이로드 금지)
     * @param content    파일 내용 (UTF-8 인코딩 후 Base64)
     * @param branch     대상 브랜치명
     * @param fileSha    기존 파일 SHA (신규 파일이면 null)
     * @param appToken   Installation Token (로그 출력 금지)
     */
    public void putFileContents(String owner, String repo, String filePath,
                                String message, String content, String branch,
                                String fileSha, String appToken) {
        // appToken 로그 출력 금지
        String encodedContent = Base64.getEncoder()
                .encodeToString(content.getBytes(StandardCharsets.UTF_8));

        Map<String, Object> body = new HashMap<>();
        body.put("message", message);
        body.put("content", encodedContent);
        body.put("branch", branch);
        if (fileSha != null && !fileSha.isBlank()) {
            // 기존 파일 업데이트 — sha 필수
            body.put("sha", fileSha);
        }

        restClient.put()
                .uri("/repos/{owner}/{repo}/contents/{filePath}", owner, repo, filePath)
                .headers(headers -> {
                    headers.setBearerAuth(appToken);
                    headers.set("Accept", "application/vnd.github+json");
                })
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .onStatus(HttpStatusCode::is4xxClientError, (req, res) -> {
                    int statusCode = res.getStatusCode().value();
                    log.warn("[github-client] 파일 커밋 실패 owner={} repo={} path={} status={}",
                            owner, repo, filePath, statusCode);
                    if (statusCode == 403) throw new BusinessException(ErrorCode.GITHUB_AUTH_REQUIRED);
                    if (statusCode == 429) throw new BusinessException(ErrorCode.GITHUB_RATE_LIMIT_EXCEEDED);
                    throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR);
                })
                .toBodilessEntity();

        log.info("[github-client] 파일 커밋 완료 owner={} repo={} path={} branch={}", owner, repo, filePath, branch);
    }

    /**
     * Pull Request를 생성한다. 자동 머지는 절대 금지한다.
     *
     * @param owner      레포지토리 소유자
     * @param repo       레포지토리 이름
     * @param title      PR 제목 (민감 정보 금지)
     * @param body       PR 본문 (마크다운, 민감 경로/페이로드 금지)
     * @param head       소스 브랜치명 (secureai/patch-xxx)
     * @param base       대상 브랜치명 (main, develop 등)
     * @param appToken   Installation Token (로그 출력 금지)
     * @return PR 생성 응답 (prUrl, prNumber 포함)
     */
    @SuppressWarnings("unchecked")
    public PullRequestResponse createPullRequest(String owner, String repo,
                                                  String title, String body,
                                                  String head, String base,
                                                  String appToken) {
        // appToken 로그 출력 금지 — auto-merge 절대 금지
        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("title", title);
        requestBody.put("body", body);
        requestBody.put("head", head);
        requestBody.put("base", base);
        // draft=false, auto-merge 옵션 없음 (PR-only 정책 준수)

        Map<String, Object> response = restClient.post()
                .uri("/repos/{owner}/{repo}/pulls", owner, repo)
                .headers(headers -> {
                    headers.setBearerAuth(appToken);
                    headers.set("Accept", "application/vnd.github+json");
                })
                .contentType(MediaType.APPLICATION_JSON)
                .body(requestBody)
                .retrieve()
                .onStatus(HttpStatusCode::is4xxClientError, (req, res) -> {
                    int statusCode = res.getStatusCode().value();
                    log.warn("[github-client] PR 생성 실패 owner={} repo={} head={} status={}",
                            owner, repo, head, statusCode);
                    if (statusCode == 403) throw new BusinessException(ErrorCode.GITHUB_AUTH_REQUIRED);
                    if (statusCode == 422) throw new BusinessException(ErrorCode.PATCH_BRANCH_CONFLICT);
                    if (statusCode == 429) throw new BusinessException(ErrorCode.GITHUB_RATE_LIMIT_EXCEEDED);
                    throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR);
                })
                .body(Map.class);

        if (response == null || response.get("number") == null || response.get("html_url") == null) {
            throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR);
        }

        int prNumber = ((Number) response.get("number")).intValue();
        String prUrl = (String) response.get("html_url");
        log.info("[github-client] PR 생성 완료 owner={} repo={} prNumber={}", owner, repo, prNumber);
        return new PullRequestResponse(prNumber, prUrl);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    /**
     * 레포지토리의 기본 브랜치명을 조회한다.
     * baseBranch 미지정 시 PR 생성에서 사용한다.
     *
     * @param owner    레포지토리 소유자
     * @param repo     레포지토리 이름
     * @param appToken Installation Token (로그 출력 금지)
     * @return 기본 브랜치명 (조회 실패 시 "main")
     */
    @SuppressWarnings("unchecked")
    public String resolveDefaultBranch(String owner, String repo, String appToken) {
        Map<String, Object> response = restClient.get()
                .uri("/repos/{owner}/{repo}", owner, repo)
                .headers(headers -> {
                    headers.setBearerAuth(appToken);
                    headers.set("Accept", "application/vnd.github+json");
                })
                .retrieve()
                .onStatus(HttpStatusCode::is4xxClientError, (req, res) -> {
                    log.warn("[github-client] 기본 브랜치 조회 실패 owner={} repo={} status={}",
                            owner, repo, res.getStatusCode().value());
                    throw new BusinessException(ErrorCode.GITHUB_REPO_NOT_FOUND);
                })
                .body(Map.class);

        if (response == null || response.get("default_branch") == null) {
            return "main";
        }
        return (String) response.get("default_branch");
    }

    // ─── Inner DTOs ──────────────────────────────────────────────────────────

    /**
     * Check Run 생성 응답 DTO.
     */
    public record CheckRunResponse(long id) {}

    /**
     * Pull Request 생성 응답 DTO.
     */
    public record PullRequestResponse(int prNumber, String prUrl) {}
}
