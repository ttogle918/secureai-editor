package io.secureai.backend.domain.user.repository;

import io.secureai.backend.domain.user.entity.UserSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserSessionRepository extends JpaRepository<UserSession, UUID> {

    @Query("SELECT s FROM UserSession s WHERE s.user.id = :userId AND s.revokedAt IS NULL AND s.expiresAt > CURRENT_TIMESTAMP ORDER BY s.createdAt DESC")
    List<UserSession> findActiveByUserId(@Param("userId") UUID userId);

    Optional<UserSession> findByJwtJti(String jwtJti);
}
