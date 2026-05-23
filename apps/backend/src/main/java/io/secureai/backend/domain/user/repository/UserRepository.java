package io.secureai.backend.domain.user.repository;

import io.secureai.backend.domain.user.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
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
    @Query(value = "UPDATE users SET sast_usage_this_month = 0, sast_usage_reset_at = DATE_TRUNC('month', NOW()) + INTERVAL '1 month' WHERE deleted_at IS NULL", nativeQuery = true)
    int resetMonthlySastUsage();

    @Query("SELECT u FROM User u JOIN FETCH u.plan WHERE u.id = :id AND u.deletedAt IS NULL")
    Optional<User> findByIdWithPlan(@Param("id") UUID id);

    @Query("""
            SELECT u FROM User u JOIN FETCH u.plan
            WHERE u.deletedAt IS NULL
            AND (:search IS NULL OR u.email LIKE %:search% OR u.username LIKE %:search%)
            AND (:planId IS NULL OR u.plan.id = :planId)
            AND (:isActive IS NULL OR u.isActive = :isActive)
            """)
    Page<User> searchUsers(@Param("search") String search,
                           @Param("planId") Short planId,
                           @Param("isActive") Boolean isActive,
                           Pageable pageable);

    /**
     * GDPR 하드 삭제 대상 조회 — deletedAt + 30일이 현재 시각 이하인 사용자.
     * 배치 처리를 위해 Pageable 로 최대 50건씩 조회한다.
     */
    @Query("SELECT u FROM User u WHERE u.deletedAt IS NOT NULL AND u.deletedAt <= :cutoff")
    Page<User> findExpiredSoftDeletedUsers(@Param("cutoff") OffsetDateTime cutoff, Pageable pageable);

    /**
     * GDPR 대기 삭제 목록 조회 — 소프트 삭제 후 아직 30일이 지나지 않은 사용자.
     * 관리자 모니터링용 엔드포인트에서 사용한다.
     */
    @Query("SELECT u FROM User u WHERE u.deletedAt IS NOT NULL AND u.deletedAt > :cutoff ORDER BY u.deletedAt ASC")
    Page<User> findPendingHardDeleteUsers(@Param("cutoff") OffsetDateTime cutoff, Pageable pageable);
}
