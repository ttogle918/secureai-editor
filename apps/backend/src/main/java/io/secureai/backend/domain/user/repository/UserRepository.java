package io.secureai.backend.domain.user.repository;

import io.secureai.backend.domain.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByEmailAndDeletedAtIsNull(String email);

    Optional<User> findByUsernameAndDeletedAtIsNull(String username);

    Optional<User> findByEmailVerifyTokenAndDeletedAtIsNull(String token);

    Optional<User> findByGithubIdAndDeletedAtIsNull(Long githubId);

    boolean existsByEmailAndDeletedAtIsNull(String email);

    boolean existsByUsernameAndDeletedAtIsNull(String username);

    @Modifying
    @Query("UPDATE User u SET u.sastUsageThisMonth = 0, " +
           "u.sastUsageResetAt = FUNCTION('DATE_TRUNC', 'month', CURRENT_TIMESTAMP) + 1 MONTH " +
           "WHERE u.deletedAt IS NULL")
    int resetMonthlySastUsage();

    @Query("SELECT u FROM User u JOIN FETCH u.plan WHERE u.id = :id AND u.deletedAt IS NULL")
    Optional<User> findByIdWithPlan(@Param("id") UUID id);
}
