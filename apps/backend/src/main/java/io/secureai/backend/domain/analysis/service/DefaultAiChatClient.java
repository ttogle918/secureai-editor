package io.secureai.backend.domain.analysis.service;

import io.secureai.backend.domain.analysis.dto.ChatRequest;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Consumer;

@Slf4j
@Component
public class DefaultAiChatClient implements AiChatClient {

    private static final int FAILURE_THRESHOLD = 3;
    private static final long RESET_TIMEOUT_MS = 30_000L;

    private final RestClient restClient;

    private final AtomicBoolean circuitOpen = new AtomicBoolean(false);
    private final AtomicLong circuitOpenTime = new AtomicLong(0L);
    private final AtomicInteger failureCount = new AtomicInteger(0);

    public DefaultAiChatClient(
            @Value("${secureai.ai-agent.url}") String agentUrl,
            @Value("${secureai.internal-api-key}") String internalKey
    ) {
        HttpClient httpClient = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(Duration.ofSeconds(10))
                .build();
        this.restClient = RestClient.builder()
                .requestFactory(new JdkClientHttpRequestFactory(httpClient))
                .baseUrl(agentUrl)
                .defaultHeader("X-Internal-Key", internalKey)
                .defaultHeader(HttpHeaders.ACCEPT, MediaType.TEXT_EVENT_STREAM_VALUE)
                .build();
    }

    @Override
    public void streamChat(UUID sessionId, ChatRequest request, Consumer<BufferedReader> streamConsumer) {
        checkCircuit();
        try {
            restClient.post()
                    .uri("/agent/chat")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(buildBody(sessionId, request))
                    .exchange((req, resp) -> {
                        if (!resp.getStatusCode().is2xxSuccessful()) {
                            log.warn("[chat-client] AI Engine 오류: sessionId={} status={}", sessionId, resp.getStatusCode());
                            return null;
                        }
                        try (BufferedReader reader = new BufferedReader(
                                new InputStreamReader(resp.getBody(), StandardCharsets.UTF_8))) {
                            streamConsumer.accept(reader);
                        } catch (IOException e) {
                            log.warn("[chat-client] stream read error: sessionId={} err={}", sessionId, e.getMessage());
                        }
                        return null;
                    });
            resetFailures();
        } catch (RestClientException e) {
            recordFailure(e);
            throw new BusinessException(ErrorCode.AI_AGENT_UNAVAILABLE);
        }
    }

    private Map<String, Object> buildBody(UUID sessionId, ChatRequest request) {
        List<Map<String, String>> history = request.history().stream()
                .map(item -> Map.of("role", item.role(), "content", item.content()))
                .toList();
        Map<String, Object> body = new HashMap<>();
        body.put("session_id", sessionId.toString());
        body.put("message", request.message());
        body.put("history", history);
        return body;
    }

    private void checkCircuit() {
        if (!circuitOpen.get()) return;
        long elapsed = System.currentTimeMillis() - circuitOpenTime.get();
        if (elapsed > RESET_TIMEOUT_MS) {
            circuitOpen.set(false);
            failureCount.set(0);
            log.info("[chat-circuit] HALF-OPEN — retrying AI Chat");
        } else {
            throw new BusinessException(ErrorCode.AI_AGENT_UNAVAILABLE);
        }
    }

    private void recordFailure(Exception e) {
        int count = failureCount.incrementAndGet();
        log.warn("[chat-circuit] failure count={} err={}", count, e.getMessage());
        if (count >= FAILURE_THRESHOLD) {
            circuitOpen.set(true);
            circuitOpenTime.set(System.currentTimeMillis());
            log.error("[chat-circuit] OPEN — AI Chat circuit breaker tripped");
        }
    }

    private void resetFailures() {
        failureCount.set(0);
    }
}
