package io.secureai.backend.domain.project.event;

import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class ProjectDeletedEventListener {

    @EventListener
    @Async("analysisExecutor")
    public void onProjectDeleted(ProjectDeletedEvent event) {
        log.info("Project soft-deleted: projectId={} ownerId={} deletedAt={}",
                event.getProjectId(), event.getOwnerId(), event.getDeletedAt());
        // Sprint 4: 72시간 후 하드 삭제 스케줄링 구현
    }
}
