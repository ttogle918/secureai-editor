package io.secureai.backend.domain.analysis.repository;

import io.secureai.backend.domain.analysis.entity.AnalysisProgressLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AnalysisProgressLogRepository extends JpaRepository<AnalysisProgressLog, UUID> {

    List<AnalysisProgressLog> findBySessionIdOrderByStepOrderAscStartedAtAsc(UUID sessionId);

    Optional<AnalysisProgressLog> findBySessionIdAndStepNameAndTarget(
            UUID sessionId, String stepName, String target);
}
