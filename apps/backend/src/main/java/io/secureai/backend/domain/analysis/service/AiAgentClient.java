package io.secureai.backend.domain.analysis.service;

import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;

/**
 * AI Agent HTTP 클라이언트.
 *
 * 단순 Circuit Breaker 내장: 연속 3회 실패 시 OPEN, 30초 후 자동 HALF-OPEN.
 * 추후 Resilience4j spring-boot4 스타터 적용으로 교체 예정.
 */
@Slf4j
@Component
public class AiAgentClient {

    private static final int FAILURE_THRESHOLD = 3;
    private static final long RESET_TIMEOUT_MS = 30_000L;

    private final RestClient restClient;
    private final String internalKey;

    private final AtomicBoolean circuitOpen = new AtomicBoolean(false);
    private final AtomicLong circuitOpenTime = new AtomicLong(0L);
    private int failureCount = 0;

    public AiAgentClient(
            @Value("${secureai.ai-agent.url}") String agentUrl,
            @Value("${secureai.internal-api-key}") String internalKey
    ) {
        this.internalKey = internalKey;
        this.restClient = RestClient.builder()
                .baseUrl(agentUrl)
                .defaultHeader("X-Internal-Key", internalKey)
                .build();
    }

    /**
     * 로컬 파일시스템 기반 분석을 시작한다.
     * 하위 호환성을 위해 유지되는 convenience 메서드.
     */
    public void startAnalysis(UUID sessionId, UUID projectId, String workspaceRoot) {
        startAnalysis(sessionId, projectId, workspaceRoot, "local", null, null, null, null);
    }

    /**
     * 분석을 시작한다. source_type에 따라 local 또는 github 경로로 동작한다.
     *
     * @param sessionId     분석 세션 UUID
     * @param projectId     프로젝트 UUID
     * @param workspaceRoot 로컬 워크스페이스 경로 (source_type=local 전용, nullable)
     * @param sourceType    "local" | "github"
     * @param githubOwner   GitHub 레포지토리 소유자 (nullable)
     * @param githubRepo    GitHub 레포지토리 이름 (nullable)
     * @param githubRef     branch/tag/commit (nullable)
     * @param githubToken   복호화된 GitHub 개인 접근 토큰 (nullable, 로그 출력 금지)
     */
    public void startAnalysis(
            UUID sessionId,
            UUID projectId,
            String workspaceRoot,
            String sourceType,
            String githubOwner,
            String githubRepo,
            String githubRef,
            String githubToken
    ) {
        checkCircuit();
        try {
            Map<String, Object> body = new HashMap<>();
            body.put("session_id", sessionId.toString());
            body.put("project_id", projectId.toString());
            body.put("workspace_root", workspaceRoot != null ? workspaceRoot : "");
            body.put("source_type", sourceType != null ? sourceType : "local");
            if (githubOwner != null) body.put("github_owner", githubOwner);
            if (githubRepo != null) body.put("github_repo", githubRepo);
            if (githubRef != null) body.put("github_ref", githubRef);
            // githubToken은 body에 포함하되 로그에 절대 출력 금지
            if (githubToken != null) body.put("github_token", githubToken);

            restClient.post()
                    .uri("/agent/analyze")
                    .body(body)
                    .retrieve()
                    .toBodilessEntity();

            resetFailures();
            // 토큰은 로그에 출력 금지
            log.info("[agent-client] startAnalysis sessionId={} sourceType={}", sessionId, sourceType);
        } catch (RestClientException e) {
            recordFailure(e);
            throw new BusinessException(ErrorCode.AI_AGENT_UNAVAILABLE);
        }
    }

    public void resumeAnalysis(UUID sessionId) {
        checkCircuit();
        try {
            restClient.post()
                    .uri("/agent/resume/{sessionId}", sessionId)
                    .retrieve()
                    .toBodilessEntity();
            resetFailures();
            log.info("[agent-client] resumeAnalysis sessionId={}", sessionId);
        } catch (RestClientException e) {
            recordFailure(e);
            throw new BusinessException(ErrorCode.AI_AGENT_UNAVAILABLE);
        }
    }

    public void cancelAnalysis(UUID sessionId) {
        if (circuitOpen.get()) return;
        try {
            restClient.post()
                    .uri("/agent/cancel/{sessionId}", sessionId)
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientException e) {
            log.warn("[agent-client] cancel failed sessionId={} err={}", sessionId, e.getMessage());
        }
    }

    public boolean isCircuitOpen() {
        return circuitOpen.get();
    }

    private void checkCircuit() {
        if (!circuitOpen.get()) return;
        long elapsed = System.currentTimeMillis() - circuitOpenTime.get();
        if (elapsed > RESET_TIMEOUT_MS) {
            circuitOpen.set(false);
            failureCount = 0;
            log.info("[circuit] HALF-OPEN — retrying AI Agent");
        } else {
            throw new BusinessException(ErrorCode.AI_AGENT_UNAVAILABLE);
        }
    }

    private synchronized void recordFailure(Exception e) {
        failureCount++;
        log.warn("[circuit] failure count={} err={}", failureCount, e.getMessage());
        if (failureCount >= FAILURE_THRESHOLD) {
            circuitOpen.set(true);
            circuitOpenTime.set(System.currentTimeMillis());
            log.error("[circuit] OPEN — AI Agent circuit breaker tripped");
        }
    }

    private synchronized void resetFailures() {
        failureCount = 0;
    }
}
