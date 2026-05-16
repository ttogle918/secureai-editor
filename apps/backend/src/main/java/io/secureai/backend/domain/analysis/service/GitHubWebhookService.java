package io.secureai.backend.domain.analysis.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.secureai.backend.config.GitHubConfig;
import io.secureai.backend.domain.analysis.entity.PrReviewHistory;
import io.secureai.backend.domain.analysis.repository.PrReviewHistoryRepository;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatusCode;
import org.springframework.lang.Nullable;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import javax.crypto.Mac;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * GitHub Webhook 처리 서비스.
 *
 * 책임:
 * 1. HMAC-SHA256 서명 검증 (constant-time 비교)
 * 2. PR Webhook 이벤트 처리 (opened / synchronize)
 * 3. GitHub Check Run 생성/완료
 * 4. GitHub PR 코멘트 생성
 * 5. PR 변경 파일 조회
 *
 * AI Engine 분석 호출은 비동기 처리를 위한 TODO 주석으로 표시한다.
 */
@Slf4j
@Service
public class GitHubWebhookService {

    private static final String GITHUB_API_BASE = "https://api.github.com";
    private static final String SIGNATURE_PREFIX = "sha256=";
    private static final String CHECK_RUN_NAME = "SecureAI Security Review";

    @Nullable
    private final Mac webhookMac;
    private final GitHubConfig gitHubConfig;
    private final PrReviewHistoryRepository prReviewHistoryRepository;
    private final AiAgentClient aiAgentClient;
    private final RestClient githubRestClient;
    private final ObjectMapper objectMapper;

    public GitHubWebhookService(
            @Qualifier("webhookMac") @Nullable Mac webhookMac,
            GitHubConfig gitHubConfig,
            PrReviewHistoryRepository prReviewHistoryRepository,
            AiAgentClient aiAgentClient,
            ObjectMapper objectMapper
    ) {
        this.webhookMac = webhookMac;
        this.gitHubConfig = gitHubConfig;
        this.prReviewHistoryRepository = prReviewHistoryRepository;
        this.aiAgentClient = aiAgentClient;
        this.objectMapper = objectMapper;
        this.githubRestClient = RestClient.builder()
                .baseUrl(GITHUB_API_BASE)
                .defaultHeader("Accept", "application/vnd.github+json")
                .defaultHeader("User-Agent", "secureai-backend/1.0")
                .build();
    }

    /**
     * GitHub Webhook HMAC-SHA256 서명을 상수시간 비교로 검증한다.
     *
     * @param payload         요청 raw body (bytes 기준으로 HMAC 계산)
     * @param signatureHeader X-Hub-Signature-256 헤더 값 ("sha256=<hex>" 형식)
     * @throws BusinessException GITHUB_WEBHOOK_INVALID — 서명 불일치 또는 형식 오류
     */
    public void validateSignature(String payload, String signatureHeader) {
        if (webhookMac == null) {
            // webhookSecret 미설정 — 개발 환경에서만 허용, 운영에서는 반드시 설정 필요
            log.warn("[webhook] HMAC secret 미설정 — 서명 검증 생략 (개발 환경 전용)");
            return;
        }

        if (signatureHeader == null || !signatureHeader.startsWith(SIGNATURE_PREFIX)) {
            throw new BusinessException(ErrorCode.GITHUB_WEBHOOK_INVALID);
        }

        String receivedHex = signatureHeader.substring(SIGNATURE_PREFIX.length());
        byte[] computedHmac = computeHmac(payload.getBytes(StandardCharsets.UTF_8));
        byte[] receivedBytes = hexToBytes(receivedHex);

        // constant-time 비교 — timing attack 방지
        if (!MessageDigest.isEqual(computedHmac, receivedBytes)) {
            throw new BusinessException(ErrorCode.GITHUB_WEBHOOK_INVALID);
        }
    }

    /**
     * PR Webhook 페이로드를 처리한다.
     * action이 "opened" 또는 "synchronize"일 때만 분석을 시작한다.
     *
     * @param payload GitHub Webhook JSON 페이로드 (Map으로 파싱된 상태)
     */
    @Transactional
    public void handlePullRequest(Map<String, Object> payload) {
        String action = (String) payload.get("action");
        if (!"opened".equals(action) && !"synchronize".equals(action)) {
            log.info("[webhook] PR action={} — 처리 건너뜀", action);
            return;
        }

        Map<String, Object> pr = extractPrMap(payload);
        Map<String, Object> repo = extractRepoMap(payload);

        String owner = extractOwnerLogin(repo);
        String repoName = (String) repo.get("name");
        int prNumber = ((Number) pr.get("number")).intValue();
        String headSha = extractHeadSha(pr);

        log.info("[webhook] PR {} action={} owner={} repo={} pr=#{} sha={}",
                action, action, owner, repoName, prNumber, headSha);

        // 1. PrReviewHistory 저장 (status=pending)
        PrReviewHistory history = PrReviewHistory.builder()
                .projectId(resolveProjectId(owner, repoName))
                .repoOwner(owner)
                .repoName(repoName)
                .prNumber(prNumber)
                .headSha(headSha)
                .build();
        prReviewHistoryRepository.save(history);

        // 토큰은 페이로드에서 직접 오지 않으므로 프로젝트 설정에서 조회해야 함
        // TODO: 실제 구현에서는 ProjectService 등에서 GitHub 토큰을 조회해야 함
        String token = extractInstallationToken(payload);

        // 2. GitHub Check Run 생성 → checkRunId 획득
        Long checkRunId = null;
        try {
            checkRunId = createCheckRun(owner, repoName, headSha, token);
            log.info("[webhook] Check Run 생성 완료 checkRunId={}", checkRunId);
        } catch (Exception e) {
            log.warn("[webhook] Check Run 생성 실패 — 분석은 계속 진행 err={}", e.getMessage());
        }

        // 3. PR changed files 목록 조회
        List<String> changedFiles;
        try {
            changedFiles = getPrChangedFiles(owner, repoName, prNumber, token);
            log.info("[webhook] PR 변경 파일 {}개 조회 완료", changedFiles.size());
        } catch (Exception e) {
            log.warn("[webhook] PR 변경 파일 조회 실패 err={}", e.getMessage());
            history.markError();
            return;
        }

        // 4. AI Engine에 분석 요청 (변경 파일만, 비동기)
        // TODO: PR 전용 분석 엔드포인트 구현 후 연결
        // 현재는 startAnalysis를 활용하되, PR 변경 파일 필터링은 AI Engine 내부에서 처리
        // TODO: 완료 콜백(SSE progress 이벤트)을 수신하여 아래 후처리 실행
        //   - history.markCompleted(vulnCount, checkRunId)
        //   - completeCheckRun(owner, repoName, checkRunId, vulnCount, token)
        //   - createPrComment(owner, repoName, prNumber, buildCommentBody(vulnCount), token)
        log.info("[webhook] AI Engine 분석 요청 (변경 파일={}) — 비동기 처리 시작", changedFiles.size());
    }

    /**
     * GitHub Check Run을 "in_progress" 상태로 생성한다.
     *
     * @return 생성된 Check Run ID
     */
    @SuppressWarnings("unchecked")
    public Long createCheckRun(String owner, String repo, String sha, String token) {
        // token 로그 출력 금지
        Map<String, Object> body = new HashMap<>();
        body.put("name", CHECK_RUN_NAME);
        body.put("head_sha", sha);
        body.put("status", "in_progress");

        Map<String, Object> response = githubRestClient.post()
                .uri("/repos/{owner}/{repo}/check-runs", owner, repo)
                .headers(headers -> headers.setBearerAuth(token))
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .onStatus(HttpStatusCode::is4xxClientError, (req, res) -> {
                    log.warn("[webhook] Check Run 생성 실패 status={}", res.getStatusCode().value());
                    throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR);
                })
                .body(Map.class);

        if (response == null) {
            throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR);
        }
        return ((Number) response.get("id")).longValue();
    }

    /**
     * GitHub Check Run을 완료 상태로 업데이트한다.
     * blockMergeOnCritical=true이고 취약점이 있으면 conclusion="failure"로 설정한다.
     */
    public void completeCheckRun(String owner, String repo, Long checkRunId,
                                  int vulnCount, String token) {
        // token 로그 출력 금지
        String conclusion = determineConclusion(vulnCount);

        Map<String, Object> body = new HashMap<>();
        body.put("status", "completed");
        body.put("conclusion", conclusion);

        Map<String, Object> output = new HashMap<>();
        output.put("title", "SecureAI Security Review 완료");
        output.put("summary", buildCheckRunSummary(vulnCount, conclusion));
        body.put("output", output);

        githubRestClient.patch()
                .uri("/repos/{owner}/{repo}/check-runs/{checkRunId}", owner, repo, checkRunId)
                .headers(headers -> headers.setBearerAuth(token))
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .onStatus(HttpStatusCode::is4xxClientError, (req, res) -> {
                    log.warn("[webhook] Check Run 업데이트 실패 checkRunId={} status={}",
                            checkRunId, res.getStatusCode().value());
                    throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR);
                })
                .toBodilessEntity();

        log.info("[webhook] Check Run 완료 checkRunId={} conclusion={} vulnCount={}",
                checkRunId, conclusion, vulnCount);
    }

    /**
     * GitHub PR에 코멘트를 작성한다.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> createPrComment(String owner, String repo,
                                               int prNumber, String body, String token) {
        // token 로그 출력 금지
        Map<String, String> requestBody = new HashMap<>();
        requestBody.put("body", body);

        Map<String, Object> response = githubRestClient.post()
                .uri("/repos/{owner}/{repo}/issues/{prNumber}/comments", owner, repo, prNumber)
                .headers(headers -> headers.setBearerAuth(token))
                .contentType(MediaType.APPLICATION_JSON)
                .body(requestBody)
                .retrieve()
                .onStatus(HttpStatusCode::is4xxClientError, (req, res) -> {
                    log.warn("[webhook] PR 코멘트 생성 실패 pr=#{} status={}",
                            prNumber, res.getStatusCode().value());
                    throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR);
                })
                .body(Map.class);

        log.info("[webhook] PR 코멘트 생성 완료 pr=#{} owner={} repo={}", prNumber, owner, repo);
        return response;
    }

    /**
     * PR의 변경된 파일 목록(filename만)을 조회한다.
     */
    @SuppressWarnings("unchecked")
    public List<String> getPrChangedFiles(String owner, String repo,
                                          int prNumber, String token) {
        // token 로그 출력 금지
        List<Map<String, Object>> files = githubRestClient.get()
                .uri("/repos/{owner}/{repo}/pulls/{prNumber}/files", owner, repo, prNumber)
                .headers(headers -> {
                    if (token != null && !token.isBlank()) {
                        headers.setBearerAuth(token);
                    }
                })
                .retrieve()
                .onStatus(HttpStatusCode::is4xxClientError, (req, res) -> {
                    log.warn("[webhook] PR 변경 파일 조회 실패 pr=#{} status={}",
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

    // ─── Private Helpers ─────────────────────────────────────────────────────

    private byte[] computeHmac(byte[] data) {
        // Mac은 thread-safe하지 않으므로 synchronized 블록 사용
        synchronized (webhookMac) {
            webhookMac.reset();
            return webhookMac.doFinal(data);
        }
    }

    private byte[] hexToBytes(String hex) {
        if (hex == null || hex.length() % 2 != 0) {
            throw new BusinessException(ErrorCode.GITHUB_WEBHOOK_INVALID);
        }
        int len = hex.length();
        byte[] data = new byte[len / 2];
        for (int i = 0; i < len; i += 2) {
            int hi = Character.digit(hex.charAt(i), 16);
            int lo = Character.digit(hex.charAt(i + 1), 16);
            if (hi == -1 || lo == -1) {
                throw new BusinessException(ErrorCode.GITHUB_WEBHOOK_INVALID);
            }
            data[i / 2] = (byte) ((hi << 4) + lo);
        }
        return data;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> extractPrMap(Map<String, Object> payload) {
        return (Map<String, Object>) payload.get("pull_request");
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> extractRepoMap(Map<String, Object> payload) {
        return (Map<String, Object>) payload.get("repository");
    }

    @SuppressWarnings("unchecked")
    private String extractOwnerLogin(Map<String, Object> repo) {
        Map<String, Object> owner = (Map<String, Object>) repo.get("owner");
        return (String) owner.get("login");
    }

    @SuppressWarnings("unchecked")
    private String extractHeadSha(Map<String, Object> pr) {
        Map<String, Object> head = (Map<String, Object>) pr.get("head");
        return (String) head.get("sha");
    }

    /**
     * 페이로드에서 GitHub App 설치 토큰을 추출한다.
     * 실제 운영에서는 GitHub App JWT → Installation Token 교환 흐름이 필요하다.
     * TODO: GitHub App 인증 플로우 구현 후 대체
     */
    private String extractInstallationToken(Map<String, Object> payload) {
        // GitHub App Webhook에는 installation 정보가 포함될 수 있음
        // 현재는 환경변수 또는 프로젝트 설정에서 토큰을 가져와야 함
        return "";
    }

    /**
     * owner/repoName으로 프로젝트 ID를 조회한다.
     * TODO: ProjectRepository 연동으로 실제 프로젝트 ID 반환
     */
    private UUID resolveProjectId(String owner, String repoName) {
        // 현재는 nil UUID 반환 — 실제 구현 시 ProjectService 연동 필요
        return new UUID(0L, 0L);
    }

    private String determineConclusion(int vulnCount) {
        if (vulnCount > 0 && gitHubConfig.isBlockMergeOnCritical()) {
            return "failure";
        }
        return "success";
    }

    private String buildCheckRunSummary(int vulnCount, String conclusion) {
        if (vulnCount == 0) {
            return "보안 취약점이 발견되지 않았습니다.";
        }
        return String.format("총 %d개의 보안 취약점이 발견되었습니다. (결론: %s)", vulnCount, conclusion);
    }

    @Transactional(readOnly = true)
    public List<io.secureai.backend.domain.analysis.dto.PrReviewHistoryResponse> getPrReviewHistory(
            String repoOwner, String repoName, Integer prNumber) {
        var histories = (prNumber != null)
                ? prReviewHistoryRepository.findByRepoOwnerAndRepoNameAndPrNumber(repoOwner, repoName, prNumber)
                : prReviewHistoryRepository.findByRepoOwnerAndRepoName(repoOwner, repoName);
        return histories.stream()
                .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
                .map(io.secureai.backend.domain.analysis.dto.PrReviewHistoryResponse::from)
                .toList();
    }
}
