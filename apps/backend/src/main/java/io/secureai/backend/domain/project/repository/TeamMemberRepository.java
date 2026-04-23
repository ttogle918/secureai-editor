package io.secureai.backend.domain.project.repository;

import io.secureai.backend.domain.project.entity.TeamMember;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TeamMemberRepository extends JpaRepository<TeamMember, UUID> {

    @EntityGraph(attributePaths = {"user", "user.plan"})
    List<TeamMember> findByProjectId(UUID projectId);

    Optional<TeamMember> findByProjectIdAndUserId(UUID projectId, UUID userId);

    boolean existsByProjectIdAndUserId(UUID projectId, UUID userId);

    int countByProjectId(UUID projectId);

    @Query("SELECT tm FROM TeamMember tm JOIN FETCH tm.user WHERE tm.project.id = :projectId AND tm.role = 'owner'")
    Optional<TeamMember> findOwnerByProjectId(@Param("projectId") UUID projectId);
}
