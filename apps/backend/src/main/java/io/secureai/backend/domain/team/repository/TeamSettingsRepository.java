package io.secureai.backend.domain.team.repository;

import io.secureai.backend.domain.team.entity.TeamSettings;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface TeamSettingsRepository extends JpaRepository<TeamSettings, UUID> {

    Optional<TeamSettings> findByTeamId(UUID teamId);
}
