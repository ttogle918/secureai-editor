package io.secureai.backend.domain.analysis.controller;

import io.secureai.backend.domain.analysis.dto.ChatRequest;
import io.secureai.backend.domain.analysis.service.ChatService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * ChatController 단위 테스트 — 인증 주체/세션/요청을 ChatService.streamChat 으로
 * 그대로 위임하고 그 SseEmitter 를 반환하는지 검증한다.
 */
@ExtendWith(MockitoExtension.class)
class ChatControllerTest {

    @Mock ChatService chatService;

    private ChatController controller;

    @BeforeEach
    void setUp() {
        controller = new ChatController(chatService);
    }

    @Test
    @DisplayName("chat — streamChat 의 SseEmitter 를 그대로 반환한다")
    void chat_relaysEmitter() {
        UUID userId = UUID.randomUUID();
        UUID sessionId = UUID.randomUUID();
        ChatRequest request = mock(ChatRequest.class);
        SseEmitter emitter = new SseEmitter();
        when(chatService.streamChat(userId, sessionId, request)).thenReturn(emitter);

        SseEmitter result = controller.chat(userId, sessionId, request);

        assertThat(result).isSameAs(emitter);
        verify(chatService).streamChat(userId, sessionId, request);
    }
}
