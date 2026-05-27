package io.secureai.backend.domain.analysis.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.secureai.backend.config.GitHubConfig;
import io.secureai.backend.domain.analysis.entity.PrReviewHistory;
import io.secureai.backend.domain.analysis.repository.PrReviewHistoryRepository;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.Mac;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * GitHub Webhook 처리 서비스.
 *
 * 책임:
 * 1. HMAC-SHA256 서명 검증 (constant-time 비교)
 * 2. PR Webhook 이벤트 처리 (opened / synchronize)
 * 3. Check Run / PR 코멘트 / 변경 파일 조회는 GitHubRestClient에 위임
 *
 * 설계 원칙:
 * - validateSignature()는 절대 수정 금지 (보안 불변식)
 * - Check Run API 실패 시 skip & log (전체 분석 실패 금지)
 * - appToken, GITHUB_TOKEN 로그 출력 금지
 * - PR 코멘트에 민감 경로 최소화 (취약점 수 요약만 포함)
 */
@Slf4j
@Service
public class GitHubWebhookService {

    private static final String SIGNATURE_PREFIX = "sha256=";
    private static final String CHECK_RUN_NAME = "SecureAI Security Review";

    @Nullable
    private final Mac webhookMac;
    private final GitHubConfig gitHubConfig;
    private final PrReviewHistoryRepository prReviewHistoryRepository;
    private final AiAgentClient aiAgentClient;
    private final GitHubRestClient gitHubRestClient;
    private final ObjectMapper objectMapper;

    public GitHubWebhookService(
            @Qualifier("webhookMac") @Nullable Mac webhookMac,
            GitHubConfig gitHubConfig,
            PrReviewHistoryRepository prReviewHistoryRepository,
            AiAgentClient aiAgentClient,
            GitHubRestClient gitHubRestClient,
            ObjectMapper objectMapper
    ) {
        this.webhookMac = webhookMac;
        this.gitHubConfig = gitHubConfig;
        this.prReviewHistoryRepository = prReviewHistoryRepository;
        this.aiAgentClient = aiAgentClient;
        this.gitHubRestClient = gitHubRestClient;
        this.objectMapper = objectMapper;
    }

    /**
     * GitHub Webhook HMAC-SHA256 서명을 상수시간 비교로 검증한다.
     *
     * 이 메서드는 보안 불변식으로, 절대 수정하지 않는다.
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
     * 처리 흐름:
     * 1. PrReviewHistory 저장 (status=pending)
     * 2. Installation Token이 있을 때만:
     *    a. Check Run 생성 (in_progress) — 실패 시 skip & log
     *    b. PR 변경 파일 조회
     * 3. AI Engine 분석 요청 (비동기)
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

        log.info("[webhook] PR action={} owner={} repo={} pr=#{} sha={}",
                action, owner, repoName, prNumber, headSha);

        // 1. PrReviewHistory 저장 (status=pending)
        PrReviewHistory history = PrReviewHistory.builder()
                .projectId(resolveProjectId(owner, repoName))
                .repoOwner(owner)
                .repoName(repoName)
                .prNumber(prNumber)
                .headSha(headSha)
                .build();
        prReviewHistoryRepository.save(history);

        // Installation Token 조회 — 미구현 시 Check Run / 파일 조회 skip
        // TODO: GitHub App JWT → Installation Token 교환 플로우 구현 후 대체 (TASK-502 후속)
        String token = extractInstallationToken(payload);
        boolean hasToken = token != null && !token.isBlank();

        if (!hasToken) {
            log.warn("[webhook] Installation Token 미설정 — Check Run 및 파일 조회를 건너뜀. " +
                     "GitHub App 인증 플로우 구현 후 활성화 필요");
        }

        // 2a. Check Run 생성 (in_progress) — 토큰 있을 때만, 실패 시 skip & log
        Long checkRunId = null;
        if (hasToken) {
            try {
                GitHubRestClient.CheckRunResponse checkRun = gitHubRestClient.createCheckRun(
                        owner, repoName, headSha, CHECK_RUN_NAME, "in_progress", token);
                checkRunId = checkRun.id();
                log.info("[webhook] Check Run 생성 완료 checkRunId={}", checkRunId);
            } catch (Exception e) {
                log.warn("[webhook] Check Run 생성 실패 — 분석은 계속 진행 err={}", e.getMessage());
            }
        }

        // 2b. PR changed files 목록 조회 — 토큰 있을 때만
        List<String> changedFiles = List.of();
        if (hasToken) {
            try {
                changedFiles = gitHubRestClient.getPrChangedFiles(owner, repoName, prNumber, token);
                log.info("[webhook] PR 변경 파일 {}개 조회 완료", changedFiles.size());
            } catch (Exception e) {
                log.warn("[webhook] PR 변경 파일 조회 실패 err={}", e.getMessage());
                history.markError();
                finalizeCheckRunOnError(owner, repoName, checkRunId, token);
                return;
            }
        }

        final Long finalCheckRunId = checkRunId;

        // 3. AI Engine에 분석 요청 (변경 파일만, 비동기)
        // TODO: PR 전용 분석 엔드포인트 구현 후 연결
        // 분석 완료 콜백 수신 시:
        //   - history.markCompleted(vulnCount, finalCheckRunId)
        //   - completeCheckRunAfterAnalysis(owner, repoName, finalCheckRunId, vulnCount, prNumber, token)
        log.info("[webhook] AI Engine 분석 요청 (변경 파일={}) — 비동기 처리 시작", changedFiles.size());
    }

    /**
     * 분석 완료 후 Check Run을 완료 처리하고 PR 코멘트를 등록한다.
     * Check Run / PR 코멘트 API 실패 시 skip & log (전체 분석 결과를 막지 않음).
     *
     * @param owner      레포지토리 소유자
     * @param repo       레포지토리 이름
     * @param checkRunId 완료할 Check Run ID (null이면 skip)
     * @param vulnCount  발견된 취약점 수
     * @param prNumber   PR 번호
     * @param token      GitHub 토큰 (로그 출력 금지)
     */
    public void completeCheckRunAfterAnalysis(String owner, String repo, Long checkRunId,
                                               int vulnCount, int prNumber, String token) {
        // Check Run 완료 — 실패 시 skip & log
        if (checkRunId != null && token != null && !token.isBlank()) {
            try {
                String conclusion = determineConclusion(vulnCount);
                String summary = buildCheckRunSummary(vulnCount, conclusion);
                gitHubRestClient.completeCheckRun(owner, repo, checkRunId, conclusion, summary, token);
                log.info("[webhook] Check Run 완료 처리 checkRunId={} conclusion={}", checkRunId, conclusion);
            } catch (Exception e) {
                log.warn("[webhook] Check Run 완료 실패 — 분석 결과는 유지 err={}", e.getMessage());
            }
        }

        // PR 코멘트 등록 — 실패 시 skip & log
        // 보안 규칙: 민감 경로 최소화 — 파일명/라인 전체 노출 대신 요약만
        if (token != null && !token.isBlank()) {
            try {
                String commentBody = buildPrCommentBody(vulnCount);
                gitHubRestClient.createPrComment(owner, repo, prNumber, commentBody, token);
                log.info("[webhook] PR 코멘트 등록 완료 pr=#{}", prNumber);
            } catch (Exception e) {
                log.warn("[webhook] PR 코멘트 등록 실패 — 분석 결과는 유지 err={}", e.getMessage());
            }
        }
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

    // ─── Private Helpers ─────────────────────────────────────────────────────────

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
     *
     * 현재는 빈 문자열을 반환하며, 호출 측에서 blank 여부를 확인 후 skip 처리한다.
     * TODO: GitHub App 인증 플로우 구현 후 대체 (TASK-502 후속)
     */
    private String extractInstallationToken(Map<String, Object> payload) {
        return "";
    }

    /**
     * owner/repoName으로 프로젝트 ID를 조회한다.
     * TODO: ProjectRepository 연동으로 실제 프로젝트 ID 반환
     */
    private UUID resolveProjectId(String owner, String repoName) {
        return new UUID(0L, 0L);
    }

    /**
     * Critical 취약점 수에 따라 Check Run conclusion을 결정한다.
     *
     * @param vulnCount 발견된 취약점 수
     * @return "failure" (Critical 취약점 있고 blockMergeOnCritical=true) | "success"
     */
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
        // 민감 경로 노출 금지 — 취약점 수 요약만 포함
        return String.format("총 %d개의 보안 취약점이 발견되었습니다. (결론: %s)", vulnCount, conclusion);
    }

    /**
     * PR 코멘트 본문을 생성한다.
     * 보안 규칙: 파일명/라인 전체 노출 대신 취약점 수 요약만 포함한다.
     */
    private String buildPrCommentBody(int vulnCount) {
        if (vulnCount == 0) {
            return "## SecureAI Security Review\n\n보안 취약점이 발견되지 않았습니다.";
        }
        return String.format(
                "## SecureAI Security Review\n\n%d개의 보안 취약점이 발견되었습니다.\n\n" +
                "자세한 분석 결과는 SecureAI 대시보드에서 확인하세요.",
                vulnCount
        );
    }

    /**
     * 파일 조회 실패 등 오류 상황에서 Check Run을 failure로 완료한다.
     * 실패 시 skip & log.
     */
    private void finalizeCheckRunOnError(String owner, String repo, Long checkRunId, String token) {
        if (checkRunId == null || token == null || token.isBlank()) {
            return;
        }
        try {
            gitHubRestClient.completeCheckRun(
                    owner, repo, checkRunId,
                    "failure",
                    "PR 변경 파일 조회 실패로 분석을 완료할 수 없습니다.",
                    token
            );
        } catch (Exception ex) {
            log.warn("[webhook] Check Run 오류 완료 처리 실패 err={}", ex.getMessage());
        }
    }
}
