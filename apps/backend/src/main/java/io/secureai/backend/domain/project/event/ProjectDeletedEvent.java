package io.secureai.backend.domain.project.event;

import org.springframework.context.ApplicationEvent;

import java.time.OffsetDateTime;
import java.util.UUID;

public class ProjectDeletedEvent extends ApplicationEvent {

    private final UUID projectId;
    private final UUID ownerId;
    private final OffsetDateTime deletedAt;

    public ProjectDeletedEvent(Object source, UUID projectId, UUID ownerId, OffsetDateTime deletedAt) {
        super(source);
        this.projectId = projectId;
        this.ownerId = ownerId;
        this.deletedAt = deletedAt;
    }

    public UUID getProjectId() { return projectId; }
    public UUID getOwnerId()   { return ownerId; }
    public OffsetDateTime getDeletedAt() { return deletedAt; }
}
