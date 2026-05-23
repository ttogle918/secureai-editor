package io.secureai.backend.domain.analysis.service;

import io.secureai.backend.domain.analysis.dto.ChatRequest;

import java.io.BufferedReader;
import java.util.UUID;
import java.util.function.Consumer;

public interface AiChatClient {
    /**
     * AI Engine 채팅 SSE 스트림을 연다. streamConsumer가 반환될 때 연결이 닫힌다.
     * X-Internal-Key 헤더 설정, RestClient 관리는 구현체가 담당한다.
     */
    void streamChat(UUID sessionId, ChatRequest request, Consumer<BufferedReader> streamConsumer);
}
