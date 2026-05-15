package io.secureai.backend.domain.analysis.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.secureai.backend.domain.analysis.dto.PrReviewHistoryResponse;
import io.secureai.backend.domain.analysis.service.GitHubWebhookService;
import io.secureai.backend.global.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * GitHub Webhook 수신 컨트롤러.
 *
 * 엔드포인트: POST /api/v1/webhooks/github
 * 인증: HMAC-SHA256 서명 검증 (X-Hub-Signature-256 헤더)
 * SecurityConfig에서 permitAll 처리 — JWT 인증 불필요
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/webhooks")
@RequiredArgsConstructor
public class GitHubWebhookController {

    private final GitHubWebhookService webhookService;
    private final ObjectMapper objectMapper;

    /**
     * GitHub Webhook 이벤트를 수신하고 비동기로 처리한다.
     *
     * @param rawBody   요청 raw body (HMAC 검증에 원본 bytes 필요)
     * @param signature X-Hub-Signature-256 헤더 (sha256=<hex> 형식)
     * @param event     X-GitHub-Event 헤더 (이벤트 유형)
     * @return 202 Accepted — 처리는 비동기로 진행
     */
    @PostMapping("/github")
    public ResponseEntity<Void> receiveWebhook(
            @RequestBody String rawBody,
            @RequestHeader("X-Hub-Signature-256") String signature,
            @RequestHeader("X-GitHub-Event") String event
    ) {
        log.info("[webhook-controller] 이벤트 수신 event={}", event);

        // 1. 서명 검증 — 실패 시 BusinessException(GITHUB_WEBHOOK_INVALID) 발생
        webhookService.validateSignature(rawBody, signature);

        // 2. 이벤트 유형별 처리
        if ("pull_request".equals(event)) {
            Map<String, Object> payload = parsePayload(rawBody);
            webhookService.handlePullRequest(payload);
        } else {
            log.info("[webhook-controller] 미지원 이벤트 event={} — 무시", event);
        }

        return ResponseEntity.accepted().build();
    }

    /**
     * PR 리뷰 이력을 조회한다.
     * GET /api/v1/webhooks/github/history?repoOwner=&repoName=[&prNumber=]
     * prNumber 생략 시 해당 레포지토리 전체 이력 반환.
     */
    @GetMapping("/github/history")
    public ResponseEntity<ApiResponse<List<PrReviewHistoryResponse>>> getHistory(
            @AuthenticationPrincipal UUID userId,
            @RequestParam String repoOwner,
            @RequestParam String repoName,
            @RequestParam(required = false) Integer prNumber) {
        return ResponseEntity.ok(ApiResponse.success(
                webhookService.getPrReviewHistory(repoOwner, repoName, prNumber)));
    }

    private Map<String, Object> parsePayload(String rawBody) {
        try {
            return objectMapper.readValue(rawBody, new TypeReference<>() {});
        } catch (Exception e) {
            log.warn("[webhook-controller] payload 파싱 실패: {}", e.getMessage());
            return Map.of();
        }
    }
}
