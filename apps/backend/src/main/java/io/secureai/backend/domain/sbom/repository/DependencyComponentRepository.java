package io.secureai.backend.domain.sbom.repository;

import io.secureai.backend.domain.sbom.entity.DependencyComponent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface DependencyComponentRepository extends JpaRepository<DependencyComponent, UUID> {

    List<DependencyComponent> findBySessionId(UUID sessionId);

    List<DependencyComponent> findByArtifactIdContainingIgnoreCase(String artifactId);
}
