package io.secureai.backend.domain.analysis.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.secureai.backend.domain.analysis.dto.ProgressEvent;
import io.secureai.backend.domain.analysis.entity.AnalysisSession;
import io.secureai.backend.domain.analysis.event.SessionCompletedEvent;
import io.secureai.backend.domain.analysis.repository.AnalysisSessionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Slf4j
@Component
@RequiredArgsConstructor
public class RedisSubscriber implements MessageListener {

    private final SseEmitterService sseEmitterService;
    private final AnalysisSessionRepository sessionRepository;
    private final ObjectMapper objectMapper;
    private final ApplicationEventPublisher eventPublisher;

    @Override
    @Transactional
    public void onMessage(Message message, byte[] pattern) {
        try {
            String channel = new String(message.getChannel());
            String body = new String(message.getBody());

            // 채널에서 sessionId 추출: secureai:progress:{uuid}
            String sessionIdStr = channel.substring(channel.lastIndexOf(':') + 1);
            UUID sessionId = UUID.fromString(sessionIdStr);

            ProgressEvent event = objectMapper.readValue(body, ProgressEvent.class);
            sseEmitterService.send(sessionId, event);

            if ("completed".equals(event.type())) {
                sessionRepository.findById(sessionId).ifPresent(session -> {
                    session.markCompleted();
                    sessionRepository.save(session);
                    eventPublisher.publishEvent(new SessionCompletedEvent(
                            this, sessionId, session.getProject().getId(), session.getUser().getId()));
                    log.info("[redis-sub] session completed sessionId={}", sessionId);
                });
                sseEmitterService.complete(sessionId);
            } else if ("error".equals(event.type())) {
                sessionRepository.findById(sessionId).ifPresent(session -> {
                    session.markError();
                    sessionRepository.save(session);
                    log.warn("[redis-sub] session error sessionId={}", sessionId);
                });
                sseEmitterService.complete(sessionId);
            }
        } catch (Exception e) {
            log.warn("[redis-sub] failed to process message: {}", e.getMessage());
        }
    }
}
