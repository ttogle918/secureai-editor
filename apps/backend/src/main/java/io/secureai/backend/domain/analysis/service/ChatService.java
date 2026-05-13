package io.secureai.backend.domain.analysis.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.secureai.backend.domain.analysis.dto.ChatRequest;
import io.secureai.backend.domain.analysis.entity.AnalysisSession;
import io.secureai.backend.domain.analysis.repository.AnalysisSessionRepository;
import io.secureai.backend.domain.project.repository.TeamMemberRepository;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * AI Engine 채팅 엔드포인트를 호출하고 SSE 스트림을 클라이언트에 relay 한다.
 *
 * <p>Spring MVC (WebMVC, no WebFlux) 환경에서 가상 스레드(Virtual Thread)를 활용하여
 * 블로킹 I/O 를 처리한다.
 */
@Slf4j
@Service
public class ChatService {

    private static final long SSE_TIMEOUT_MS = 5 * 60 * 1000L; // 5분
    private static final String SSE_EVENT_DELTA = "delta";
    private static final String SSE_EVENT_DONE  = "done";
    private static final String SSE_EVENT_ERROR = "error";

    private final RestClient restClient;
    private final AnalysisSessionRepository sessionRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final ObjectMapper objectMapper;
    private final ExecutorService executor;

    public ChatService(
            @Value("${secureai.ai-agent.url}") String agentUrl,
            @Value("${secureai.internal-api-key}") String internalKey,
            AnalysisSessionRepository sessionRepository,
            TeamMemberRepository teamMemberRepository,
            ObjectMapper objectMapper
    ) {
        this.restClient = RestClient.builder()
                .baseUrl(agentUrl)
                .defaultHeader("X-Internal-Key", internalKey)
                .defaultHeader(HttpHeaders.ACCEPT, MediaType.TEXT_EVENT_STREAM_VALUE)
                .build();
        this.sessionRepository = sessionRepository;
        this.teamMemberRepository = teamMemberRepository;
        this.objectMapper = objectMapper;
        // Virtual Thread 기반 실행자 — 블로킹 스트리밍 I/O 처리
        this.executor = Executors.newVirtualThreadPerTaskExecutor();
    }

    /**
     * 세션 소유권을 검증한 뒤 AI Engine 채팅 스트림을 SseEmitter 로 relay 한다.
     *
     * @param userId    인증된 사용자 ID
     * @param sessionId 분석 세션 ID
     * @param request   채팅 요청 (메시지 + 이력)
     * @return SSE 이미터 (클라이언트에 직접 전달)
     */
    public SseEmitter streamChat(UUID userId, UUID sessionId, ChatRequest request) {
        AnalysisSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new BusinessException(ErrorCode.SESSION_NOT_FOUND));

        if (!teamMemberRepository.existsByProjectIdAndUserId(session.getProject().getId(), userId)) {
            throw new BusinessException(ErrorCode.PROJECT_ACCESS_DENIED);
        }

        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT_MS);
        executor.submit(() -> relayStream(sessionId, request, emitter));
        return emitter;
    }

    // ------------------------------------------------------------------
    // 내부 구현 — AI Engine 스트림 relay
    // ------------------------------------------------------------------

    private void relayStream(UUID sessionId, ChatRequest request, SseEmitter emitter) {
        Map<String, Object> body = buildRequestBody(sessionId, request);

        try {
            restClient.post()
                    .uri("/agent/chat")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .exchange((req, resp) -> {
                        if (!resp.getStatusCode().is2xxSuccessful()) {
                            emitter.completeWithError(
                                    new IOException("AI Engine 응답 오류: " + resp.getStatusCode()));
                            return null;
                        }
                        try (InputStream is = resp.getBody();
                             BufferedReader reader = new BufferedReader(
                                     new InputStreamReader(is, StandardCharsets.UTF_8))) {
                            relayLines(sessionId, reader, emitter);
                        }
                        return null;
                    });
        } catch (Exception e) {
            log.warn("[chat-relay] session={} relay error: {}", sessionId, e.getMessage());
            sendErrorEvent(emitter, e.getMessage());
        }
    }

    private void relayLines(UUID sessionId, BufferedReader reader, SseEmitter emitter) {
        String currentEvent = null;
        try {
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.startsWith("event: ")) {
                    currentEvent = line.substring("event: ".length()).trim();
                } else if (line.startsWith("data: ")) {
                    String data = line.substring("data: ".length()).trim();
                    forwardEvent(emitter, currentEvent, data);
                    if (SSE_EVENT_DONE.equals(currentEvent) || SSE_EVENT_ERROR.equals(currentEvent)) {
                        emitter.complete();
                        return;
                    }
                }
            }
            emitter.complete();
        } catch (IOException e) {
            log.warn("[chat-relay] session={} read error: {}", sessionId, e.getMessage());
            sendErrorEvent(emitter, e.getMessage());
        }
    }

    private void forwardEvent(SseEmitter emitter, String eventName, String jsonData) {
        String name = eventName != null ? eventName : SSE_EVENT_DELTA;
        try {
            emitter.send(SseEmitter.event().name(name).data(jsonData));
        } catch (IOException e) {
            log.debug("[chat-relay] send failed event={} err={}", name, e.getMessage());
        }
    }

    private void sendErrorEvent(SseEmitter emitter, String message) {
        try {
            String errorJson = objectMapper.writeValueAsString(Map.of("message", message != null ? message : "unknown"));
            emitter.send(SseEmitter.event().name(SSE_EVENT_ERROR).data(errorJson));
            emitter.complete();
        } catch (IOException ex) {
            emitter.completeWithError(ex);
        }
    }

    private Map<String, Object> buildRequestBody(UUID sessionId, ChatRequest request) {
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
