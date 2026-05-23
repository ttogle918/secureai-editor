package io.secureai.backend.domain.analysis.service;

import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.secureai.backend.domain.analysis.dto.CommitScanRequest;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@SuppressWarnings("unchecked")
@Slf4j
@Component
public class DefaultAiAgentClient implements AiAgentClient {

    private static final String CB_NAME = "aiAgent";

    private final RestClient restClient;
    private final CircuitBreakerRegistry circuitBreakerRegistry;

    public DefaultAiAgentClient(
            @Value("${secureai.ai-agent.url}") String agentUrl,
            @Value("${secureai.internal-api-key}") String internalKey,
            CircuitBreakerRegistry circuitBreakerRegistry
    ) {
        this.circuitBreakerRegistry = circuitBreakerRegistry;
        HttpClient httpClient = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(Duration.ofSeconds(10))
                .build();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(httpClient);
        factory.setReadTimeout(Duration.ofSeconds(30));
        this.restClient = RestClient.builder()
                .requestFactory(factory)
                .baseUrl(agentUrl)
                .defaultHeader("X-Internal-Key", internalKey)
                .build();
    }

    @Override
    @CircuitBreaker(name = CB_NAME, fallbackMethod = "startAnalysisLocalFallback")
    public void startAnalysis(UUID sessionId, UUID projectId, String workspaceRoot) {
        doStartAnalysis(sessionId, projectId, workspaceRoot, "local", null, null, null, null, null, null);
    }

    @SuppressWarnings("unused")
    private void startAnalysisLocalFallback(UUID sessionId, UUID projectId, String workspaceRoot, Throwable t) {
        log.warn("[circuit] startAnalysis fallback triggered sessionId={} cause={}", sessionId, t.getMessage());
        throw new BusinessException(ErrorCode.AI_AGENT_UNAVAILABLE);
    }

    @Override
    @CircuitBreaker(name = CB_NAME, fallbackMethod = "startAnalysisFallback")
    public void startAnalysis(
            UUID sessionId, UUID projectId, String workspaceRoot, String sourceType,
            String githubOwner, String githubRepo, String githubRef, String githubToken,
            String preferredModel, String userApiKey
    ) {
        doStartAnalysis(sessionId, projectId, workspaceRoot, sourceType,
                githubOwner, githubRepo, githubRef, githubToken, preferredModel, userApiKey);
    }

    private void doStartAnalysis(
            UUID sessionId, UUID projectId, String workspaceRoot, String sourceType,
            String githubOwner, String githubRepo, String githubRef, String githubToken,
            String preferredModel, String userApiKey
    ) {
        Map<String, Object> body = new HashMap<>();
        body.put("session_id", sessionId.toString());
        body.put("project_id", projectId.toString());
        body.put("workspace_root", workspaceRoot != null ? workspaceRoot : "");
        body.put("source_type", sourceType != null ? sourceType : "local");
        if (githubOwner != null) body.put("github_owner", githubOwner);
        if (githubRepo != null) body.put("github_repo", githubRepo);
        if (githubRef != null) body.put("github_ref", githubRef);
        if (githubToken != null) body.put("github_token", githubToken);
        if (preferredModel != null) body.put("preferred_model", preferredModel);
        if (userApiKey != null) body.put("user_api_key", userApiKey);

        restClient.post()
                .uri("/agent/analyze")
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .toBodilessEntity();

        log.info("[agent-client] startAnalysis sessionId={} sourceType={}", sessionId, sourceType);
    }

    @SuppressWarnings("unused")
    private void startAnalysisFallback(
            UUID sessionId, UUID projectId, String workspaceRoot, String sourceType,
            String githubOwner, String githubRepo, String githubRef, String githubToken,
            String preferredModel, String userApiKey, Throwable t
    ) {
        log.warn("[circuit] startAnalysis fallback triggered sessionId={} cause={}", sessionId, t.getMessage());
        throw new BusinessException(ErrorCode.AI_AGENT_UNAVAILABLE);
    }

    @Override
    @CircuitBreaker(name = CB_NAME, fallbackMethod = "resumeAnalysisFallback")
    public void resumeAnalysis(UUID sessionId) {
        restClient.post()
                .uri("/agent/resume/{sessionId}", sessionId)
                .retrieve()
                .toBodilessEntity();
        log.info("[agent-client] resumeAnalysis sessionId={}", sessionId);
    }

    @SuppressWarnings("unused")
    private void resumeAnalysisFallback(UUID sessionId, Throwable t) {
        log.warn("[circuit] resumeAnalysis fallback triggered sessionId={} cause={}", sessionId, t.getMessage());
        throw new BusinessException(ErrorCode.AI_AGENT_UNAVAILABLE);
    }

    @Override
    public void cancelAnalysis(UUID sessionId) {
        // circuit이 OPEN이어도 cancel은 best-effort로 시도 (실패해도 무시)
        try {
            restClient.post()
                    .uri("/agent/cancel/{sessionId}", sessionId)
                    .retrieve()
                    .toBodilessEntity();
        } catch (Exception e) {
            log.warn("[agent-client] cancel failed sessionId={} err={}", sessionId, e.getMessage());
        }
    }

    @Override
    public boolean isCircuitOpen() {
        return circuitBreakerRegistry.circuitBreaker(CB_NAME).getState()
                == io.github.resilience4j.circuitbreaker.CircuitBreaker.State.OPEN;
    }

    @Override
    @CircuitBreaker(name = CB_NAME, fallbackMethod = "translateFallback")
    public String translate(String text, String targetLang, String userApiKey) {
        Map<String, Object> body = new HashMap<>();
        body.put("text", text);
        body.put("target_lang", targetLang != null ? targetLang : "ko");
        if (userApiKey != null) body.put("user_api_key", userApiKey);

        Map<String, Object> result = restClient.post()
                .uri("/agent/translate")
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(Map.class);

        return result != null ? (String) result.getOrDefault("translated_text", text) : text;
    }

    @SuppressWarnings("unused")
    private String translateFallback(String text, String targetLang, String userApiKey, Throwable t) {
        log.warn("[circuit] translate fallback triggered cause={}", t.getMessage());
        return text;
    }

    @Override
    @CircuitBreaker(name = CB_NAME, fallbackMethod = "startDastFallback")
    public void startDast(UUID sessionId, UUID vulnId, String vulnType,
                          String targetUrl, String endpoint, Map<String, Object> params) {
        Map<String, Object> body = new HashMap<>();
        body.put("session_id", sessionId.toString());
        body.put("vuln_id",    vulnId.toString());
        body.put("vuln_type",  vulnType);
        body.put("target_url", targetUrl);
        body.put("endpoint",   endpoint != null ? endpoint : "");
        body.put("params",     params != null ? params : Map.of());

        restClient.post()
                .uri("/agent/dast/start")
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .toBodilessEntity();

        log.info("[agent-client] startDast sessionId={} vulnType={}", sessionId, vulnType);
    }

    @SuppressWarnings("unused")
    private void startDastFallback(UUID sessionId, UUID vulnId, String vulnType,
                                   String targetUrl, String endpoint, Map<String, Object> params,
                                   Throwable t) {
        log.warn("[circuit] startDast fallback triggered sessionId={} cause={}", sessionId, t.getMessage());
        throw new BusinessException(ErrorCode.AI_AGENT_UNAVAILABLE);
    }

    @Override
    @CircuitBreaker(name = CB_NAME, fallbackMethod = "startCommitScanFallback")
    public void startCommitScan(UUID sessionId, UUID projectId, CommitScanRequest req, String githubToken) {
        Map<String, Object> body = new HashMap<>();
        body.put("session_id", sessionId.toString());
        body.put("project_id", projectId.toString());
        body.put("owner",      req.owner());
        body.put("repo",       req.repo());
        body.put("per_page",   req.perPage());
        if (req.ref() != null)            body.put("ref",             req.ref());
        if (githubToken != null)           body.put("github_token",    githubToken);
        if (req.preferredModel() != null)  body.put("preferred_model", req.preferredModel());
        if (req.userApiKey() != null)      body.put("user_api_key",    req.userApiKey());

        restClient.post()
                .uri("/agent/scan-commits")
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .toBodilessEntity();

        log.info("[agent-client] startCommitScan sessionId={} owner={} repo={}", sessionId, req.owner(), req.repo());
    }

    @SuppressWarnings("unused")
    private void startCommitScanFallback(UUID sessionId, UUID projectId,
                                         CommitScanRequest req, String githubToken, Throwable t) {
        log.warn("[circuit] startCommitScan fallback triggered sessionId={} cause={}", sessionId, t.getMessage());
        throw new BusinessException(ErrorCode.AI_AGENT_UNAVAILABLE);
    }
}
