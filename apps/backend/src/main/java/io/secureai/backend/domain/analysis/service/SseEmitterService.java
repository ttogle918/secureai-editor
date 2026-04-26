package io.secureai.backend.domain.analysis.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
public class SseEmitterService {

    private static final long SSE_TIMEOUT_MS = 30 * 60 * 1000L; // 30분
    private final ConcurrentHashMap<UUID, SseEmitter> emitters = new ConcurrentHashMap<>();

    public SseEmitter subscribe(UUID sessionId) {
        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT_MS);
        emitters.put(sessionId, emitter);

        emitter.onTimeout(() -> {
            log.debug("[sse] timeout sessionId={}", sessionId);
            emitters.remove(sessionId);
        });
        emitter.onCompletion(() -> emitters.remove(sessionId));
        emitter.onError(e -> {
            log.debug("[sse] error sessionId={} err={}", sessionId, e.getMessage());
            emitters.remove(sessionId);
        });

        return emitter;
    }

    public void send(UUID sessionId, Object data) {
        SseEmitter emitter = emitters.get(sessionId);
        if (emitter == null) return;

        try {
            emitter.send(SseEmitter.event().name("progress").data(data));
        } catch (IOException e) {
            log.debug("[sse] send failed sessionId={}", sessionId);
            emitters.remove(sessionId);
        }
    }

    public void complete(UUID sessionId) {
        SseEmitter emitter = emitters.remove(sessionId);
        if (emitter != null) emitter.complete();
    }

    public void completeWithError(UUID sessionId, Throwable t) {
        SseEmitter emitter = emitters.remove(sessionId);
        if (emitter != null) emitter.completeWithError(t);
    }
}
