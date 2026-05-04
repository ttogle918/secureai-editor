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

@Slf4j
@Component
public class DefaultAiAgentClient implements AiAgentClient {

    private static final int FAILURE_THRESHOLD = 3;
    private static final long RESET_TIMEOUT_MS = 30_000L;

    private final RestClient restClient;

    private final AtomicBoolean circuitOpen = new AtomicBoolean(false);
    private final AtomicLong circuitOpenTime = new AtomicLong(0L);
    private int failureCount = 0;

    public DefaultAiAgentClient(
            @Value("${secureai.ai-agent.url}") String agentUrl,
            @Value("${secureai.internal-api-key}") String internalKey
    ) {
        this.restClient = RestClient.builder()
                .baseUrl(agentUrl)
                .defaultHeader("X-Internal-Key", internalKey)
                .build();
    }

    @Override
    public void startAnalysis(UUID sessionId, UUID projectId, String workspaceRoot) {
        startAnalysis(sessionId, projectId, workspaceRoot, "local", null, null, null, null);
    }

    @Override
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
            if (githubToken != null) body.put("github_token", githubToken);

            restClient.post()
                    .uri("/agent/analyze")
                    .body(body)
                    .retrieve()
                    .toBodilessEntity();

            resetFailures();
            log.info("[agent-client] startAnalysis sessionId={} sourceType={}", sessionId, sourceType);
        } catch (RestClientException e) {
            recordFailure(e);
            throw new BusinessException(ErrorCode.AI_AGENT_UNAVAILABLE);
        }
    }

    @Override
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

    @Override
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

    @Override
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
