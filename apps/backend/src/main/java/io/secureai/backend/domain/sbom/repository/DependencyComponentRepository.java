package io.secureai.backend.domain.sbom.repository;

import io.secureai.backend.domain.sbom.entity.DependencyComponent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface DependencyComponentRepository extends JpaRepository<DependencyComponent, UUID> {

    /**
     * session 관계 엔티티의 id로 검색 (Spring Data JPA 탐색 표현식).
     * DependencyComponent.session.id = sessionId
     */
    List<DependencyComponent> findBySession_Id(UUID sessionId);

    List<DependencyComponent> findByArtifactIdContainingIgnoreCase(String artifactId);
}
