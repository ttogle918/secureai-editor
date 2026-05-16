package io.secureai.backend.domain.analysis.service;

import io.secureai.backend.domain.analysis.dto.ChatRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

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
import java.util.function.Consumer;

@Slf4j
@Component
public class DefaultAiChatClient implements AiChatClient {

    private final RestClient restClient;

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
}
