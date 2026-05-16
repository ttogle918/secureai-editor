package io.secureai.backend.domain.analysis.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.secureai.backend.domain.analysis.dto.ChatRequest;
import io.secureai.backend.domain.analysis.entity.AnalysisSession;
import io.secureai.backend.domain.analysis.repository.AnalysisSessionRepository;
import io.secureai.backend.domain.project.repository.TeamMemberRepository;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.BufferedReader;
import java.io.IOException;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * AI Engine 채팅 SSE 스트림을 SseEmitter 로 relay 한다.
 * AI Engine 연결은 AiChatClient에 위임한다.
 */
@Slf4j
@Service
public class ChatService {

    private static final long SSE_TIMEOUT_MS = 5 * 60 * 1000L;
    private static final String SSE_EVENT_DELTA = "delta";
    private static final String SSE_EVENT_DONE  = "done";
    private static final String SSE_EVENT_ERROR = "error";

    private final AiChatClient aiChatClient;
    private final AnalysisSessionRepository sessionRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final ObjectMapper objectMapper;
    private final ExecutorService executor;

    public ChatService(
            AiChatClient aiChatClient,
            AnalysisSessionRepository sessionRepository,
            TeamMemberRepository teamMemberRepository,
            ObjectMapper objectMapper
    ) {
        this.aiChatClient = aiChatClient;
        this.sessionRepository = sessionRepository;
        this.teamMemberRepository = teamMemberRepository;
        this.objectMapper = objectMapper;
        this.executor = Executors.newVirtualThreadPerTaskExecutor();
    }

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

    private void relayStream(UUID sessionId, ChatRequest request, SseEmitter emitter) {
        try {
            aiChatClient.streamChat(sessionId, request,
                    reader -> relayLines(sessionId, reader, emitter));
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
            String errorJson = objectMapper.writeValueAsString(
                    Map.of("message", message != null ? message : "unknown"));
            emitter.send(SseEmitter.event().name(SSE_EVENT_ERROR).data(errorJson));
            emitter.complete();
        } catch (IOException ex) {
            emitter.completeWithError(ex);
        }
    }
}
