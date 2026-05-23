package io.secureai.backend.domain.monitoring.repository;

import io.secureai.backend.domain.monitoring.entity.MonitoringResult;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface MonitoringResultRepository extends JpaRepository<MonitoringResult, UUID> {
}
