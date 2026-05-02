package io.secureai.backend.domain.patch.repository;

import io.secureai.backend.domain.patch.entity.PatchSuggestion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PatchSuggestionRepository extends JpaRepository<PatchSuggestion, UUID> {

    List<PatchSuggestion> findBySession_Id(UUID sessionId);

    Optional<PatchSuggestion> findByVulnerability_Id(UUID vulnId);
}
