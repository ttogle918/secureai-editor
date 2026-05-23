package io.secureai.backend.domain.analysis.event;

import org.springframework.context.ApplicationEvent;

import java.util.UUID;

/**
 * 분석 세션이 COMPLETED 상태로 전환될 때 발행되는 도메인 이벤트.
 * 구독자(SessionCompletedEventListener)가 FCM Push 알림을 발송한다.
 */
public class SessionCompletedEvent extends ApplicationEvent {

    private final UUID sessionId;
    private final UUID projectId;
    private final UUID userId;

    public SessionCompletedEvent(Object source, UUID sessionId, UUID projectId, UUID userId) {
        super(source);
        this.sessionId = sessionId;
        this.projectId = projectId;
        this.userId = userId;
    }

    public UUID getSessionId() { return sessionId; }
    public UUID getProjectId() { return projectId; }
    public UUID getUserId() { return userId; }
}
