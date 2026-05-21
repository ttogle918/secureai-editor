package io.secureai.backend.domain.project.repository;

import io.secureai.backend.domain.project.entity.Project;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface ProjectRepository extends JpaRepository<Project, UUID> {

    @EntityGraph(attributePaths = {"owner"})
    Optional<Project> findById(UUID id);

    boolean existsByOwnerIdAndName(UUID ownerId, String name);

    @Query("SELECT p FROM Project p JOIN FETCH p.owner WHERE p.id = :id")
    Optional<Project> findByIdWithOwner(@Param("id") UUID id);

    // N+1 방지: owner를 JOIN FETCH로 함께 조회 — teamMembers는 Project 엔티티 @BatchSize(30) 적용
    @EntityGraph(attributePaths = {"owner"})
    @Query(value = """
        SELECT DISTINCT p FROM Project p
        LEFT JOIN TeamMember tm ON tm.project = p AND tm.user.id = :userId
        WHERE (p.owner.id = :userId OR tm.user.id = :userId)
        ORDER BY p.updatedAt DESC
        """,
        countQuery = """
        SELECT COUNT(DISTINCT p) FROM Project p
        LEFT JOIN TeamMember tm ON tm.project = p AND tm.user.id = :userId
        WHERE (p.owner.id = :userId OR tm.user.id = :userId)
        """)
    Page<Project> findAllAccessibleByUser(@Param("userId") UUID userId, Pageable pageable);
}
