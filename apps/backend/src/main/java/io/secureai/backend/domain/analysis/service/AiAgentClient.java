package io.secureai.backend.domain.analysis.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.time.Duration;
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
    private final ObjectMapper objectMapper;
    private final String internalKey;

    private final AtomicBoolean circuitOpen = new AtomicBoolean(false);
    private final AtomicLong circuitOpenTime = new AtomicLong(0L);
    private int failureCount = 0;

    public AiAgentClient(
            @Value("${secureai.ai-agent.url}") String agentUrl,
            @Value("${secureai.internal-api-key}") String internalKey,
            ObjectMapper objectMapper
    ) {
        this.internalKey = internalKey;
        this.objectMapper = objectMapper;
        this.restClient = RestClient.builder()
                .baseUrl(agentUrl)
                .defaultHeader("X-Internal-Key", internalKey)
                .build();
    }

    public void startAnalysis(UUID sessionId, UUID projectId, String workspaceRoot) {
        checkCircuit();
        try {
            Map<String, Object> body = Map.of(
                    "session_id", sessionId.toString(),
                    "project_id", projectId.toString(),
                    "workspace_root", workspaceRoot
            );
            restClient.post()
                    .uri("/agent/analyze")
                    .body(body)
                    .retrieve()
                    .toBodilessEntity();

            resetFailures();
            log.info("[agent-client] startAnalysis sessionId={}", sessionId);
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
