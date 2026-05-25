package io.secureai.backend.domain.analysis.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatusCode;
import org.springframework.lang.Nullable;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * GitHub 커밋 히스토리 페이지네이션 스캐너.
 *
 * 책임 (SRP):
 * - GitHub REST API로 커밋 목록을 페이지 단위로 조회한다.
 * - 마지막으로 스캔한 SHA에 도달하면 페이지네이션을 조기 중단한다.
 * - 개별 커밋 조회 실패 시 skip & log (전체 중단 금지 — general.md 규칙).
 *
 * HTTP 호출 구현은 이 클래스가 직접 담당한다 (GitHubRestClient는 접근 검증 전용 — SRP).
 *
 * @see GitHubApiService — owner/repo 파싱 및 토큰 복호화
 * @see CommitSecretService — 시크릿 스캔 트리거 (중복 구현 금지)
 */
@Slf4j
@Service
public class CommitHistoryScanner {

    private static final int MAX_PAGES = 100;
    private static final int PAGE_SIZE = 100;

    private final RestClient restClient;

    public CommitHistoryScanner(@Qualifier("githubRestClient") RestClient restClient) {
        this.restClient = restClient;
    }

    /**
     * 커밋 히스토리를 비동기로 페이지네이션하여 수집한다.
     *
     * @param owner         GitHub 레포지토리 소유자
     * @param repo          레포지토리 이름
     * @param ref           브랜치/태그/SHA (nullable — null이면 기본 브랜치)
     * @param token         복호화된 GitHub PAT (nullable — 로그 출력 금지)
     * @param lastScannedSha 이전 스캔의 마지막 SHA (nullable — null이면 전체 스캔)
     * @return 수집된 커밋 목록 (최대 MAX_PAGES * PAGE_SIZE = 10,000개)
     */
    @Async("analysisExecutor")
    public CompletableFuture<List<CommitInfo>> scanCommitHistory(
            String owner,
            String repo,
            @Nullable String ref,
            @Nullable String token,
            @Nullable String lastScannedSha
    ) {
        log.info("[commit-scanner] start owner={} repo={} ref={} lastSha={}",
                owner, repo, ref, lastScannedSha);

        List<CommitInfo> collected = new ArrayList<>();

        for (int page = 1; page <= MAX_PAGES; page++) {
            List<CommitInfo> pageResult;
            try {
                pageResult = fetchPage(owner, repo, ref, token, page);
            } catch (Exception e) {
                log.error("[commit-scanner] page fetch failed owner={} repo={} page={}: {}",
                        owner, repo, page, e.getMessage());
                break;
            }

            if (pageResult.isEmpty()) {
                log.info("[commit-scanner] empty page — pagination complete owner={} repo={} page={}", owner, repo, page);
                break;
            }

            boolean reachedLastScan = false;
            for (CommitInfo commit : pageResult) {
                if (commit.sha().equals(lastScannedSha)) {
                    log.info("[commit-scanner] reached lastScannedSha={} — stopping pagination", lastScannedSha);
                    reachedLastScan = true;
                    break;
                }
                collected.add(commit);
            }

            if (reachedLastScan) {
                break;
            }

            log.debug("[commit-scanner] page={} collected={} total={}", page, pageResult.size(), collected.size());
        }

        log.info("[commit-scanner] done owner={} repo={} totalCommits={}", owner, repo, collected.size());
        return CompletableFuture.completedFuture(collected);
    }

    /**
     * GitHub REST API로 커밋 목록의 단일 페이지를 조회한다.
     * GET /repos/{owner}/{repo}/commits?per_page=100&page={page}
     *
     * @return 해당 페이지의 커밋 요약 목록 (빈 목록이면 더 이상 데이터 없음)
     */
    @SuppressWarnings("unchecked")
    List<CommitInfo> fetchPage(String owner, String repo, @Nullable String ref,
                               @Nullable String token, int page) {
        String url = buildCommitsUrl(owner, repo, ref, page);

        List<Map<String, Object>> items = restClient.get()
                .uri(url)
                .headers(headers -> {
                    if (token != null && !token.isBlank()) {
                        headers.set("Authorization", "Bearer " + token);
                        // token은 로그에 절대 출력 금지
                    }
                })
                .retrieve()
                .onStatus(HttpStatusCode::is4xxClientError, (request, response) -> {
                    log.warn("[commit-scanner] GitHub API 4xx status={} owner={} repo={}",
                            response.getStatusCode().value(), owner, repo);
                    throw new RuntimeException("GitHub API error: " + response.getStatusCode().value());
                })
                .body(List.class);

        if (items == null) {
            return List.of();
        }

        return items.stream()
                .map(this::mapToCommitInfo)
                .toList();
    }

    /**
     * GitHub API 응답 Map을 CommitInfo 레코드로 변환한다.
     * 변환 실패 시 skip (전체 페이지 중단 금지).
     */
    @SuppressWarnings("unchecked")
    private CommitInfo mapToCommitInfo(Map<String, Object> item) {
        try {
            String sha = (String) item.get("sha");
            Map<String, Object> commitData = (Map<String, Object>) item.get("commit");
            String message = "";
            String dateStr = "";
            String author = "unknown";

            if (commitData != null) {
                String rawMessage = (String) commitData.get("message");
                message = rawMessage != null ? rawMessage.split("\n")[0] : "";

                Map<String, Object> authorData = (Map<String, Object>) commitData.get("author");
                if (authorData != null) {
                    dateStr = (String) authorData.get("date");
                }
            }

            Map<String, Object> authorInfo = (Map<String, Object>) item.get("author");
            if (authorInfo != null) {
                String login = (String) authorInfo.get("login");
                if (login != null && !login.isBlank()) {
                    author = login;
                }
            }

            Instant timestamp = dateStr != null && !dateStr.isBlank()
                    ? Instant.parse(dateStr)
                    : Instant.EPOCH;

            Number filesChangedNum = (Number) item.get("files_changed_count");
            int filesChangedCount = filesChangedNum != null ? filesChangedNum.intValue() : 0;

            return new CommitInfo(sha, message, author, timestamp, filesChangedCount);
        } catch (Exception e) {
            log.warn("[commit-scanner] mapToCommitInfo failed item={}: {}", item.get("sha"), e.getMessage());
            return new CommitInfo(
                    (String) item.getOrDefault("sha", "unknown"),
                    "", "unknown", Instant.EPOCH, 0
            );
        }
    }

    private String buildCommitsUrl(String owner, String repo, @Nullable String ref, int page) {
        StringBuilder sb = new StringBuilder("/repos/")
                .append(owner)
                .append("/")
                .append(repo)
                .append("/commits?per_page=")
                .append(PAGE_SIZE)
                .append("&page=")
                .append(page);
        if (ref != null && !ref.isBlank()) {
            sb.append("&sha=").append(ref);
        }
        return sb.toString();
    }

    /**
     * GitHub 커밋 요약 정보.
     *
     * @param sha               커밋 SHA (40자 hex)
     * @param message           커밋 메시지 첫 번째 줄
     * @param author            작성자 GitHub 로그인 (또는 author.name)
     * @param timestamp         커밋 작성 시각 (UTC)
     * @param filesChangedCount 변경된 파일 수 (list API에서는 0으로 초기화됨)
     */
    public record CommitInfo(
            String sha,
            String message,
            String author,
            Instant timestamp,
            int filesChangedCount
    ) {}
}
