package io.secureai.backend.domain.analysis.controller;

import io.secureai.backend.domain.analysis.dto.ChatRequest;
import io.secureai.backend.domain.analysis.service.ChatService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.UUID;

/**
 * POST /api/v1/analysis/sessions/{sessionId}/chat
 *
 * <p>인증된 사용자의 채팅 메시지를 AI Engine 으로 전달하고
 * text/event-stream 형식으로 응답을 relay 한다.
 */
@RestController
@RequestMapping("/api/v1/analysis/sessions")
@RequiredArgsConstructor
public class ChatController {

    private final ChatService chatService;

    @PostMapping(
            value = "/{sessionId}/chat",
            produces = MediaType.TEXT_EVENT_STREAM_VALUE
    )
    public SseEmitter chat(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID sessionId,
            @Valid @RequestBody ChatRequest request
    ) {
        return chatService.streamChat(userId, sessionId, request);
    }
}
