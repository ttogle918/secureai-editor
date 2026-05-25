package io.secureai.backend.domain.scheduling.repository;

import io.secureai.backend.domain.scheduling.entity.ProjectSchedule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProjectScheduleRepository extends JpaRepository<ProjectSchedule, UUID> {

    Optional<ProjectSchedule> findByProjectId(UUID projectId);

    List<ProjectSchedule> findAllByIsActiveTrue();

    boolean existsByProjectId(UUID projectId);
}
