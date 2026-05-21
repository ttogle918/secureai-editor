package io.secureai.backend.domain.user.repository;

import io.secureai.backend.domain.user.entity.TotpRecoveryCode;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface TotpRecoveryCodeRepository extends JpaRepository<TotpRecoveryCode, UUID> {

    /** 미사용 복구 코드 목록 조회 */
    List<TotpRecoveryCode> findByUserIdAndUsedAtIsNull(UUID userId);

    /**
     * 동시성 보호: 복구 코드 사용 시 비관적 쓰기 락으로 조회.
     * 동일 코드의 중복 사용을 방지한다.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT r FROM TotpRecoveryCode r WHERE r.user.id = :userId AND r.usedAt IS NULL")
    List<TotpRecoveryCode> findUnusedForUpdate(@Param("userId") UUID userId);

    /** 특정 사용자의 복구 코드 전체 삭제 */
    @Modifying
    @Query("DELETE FROM TotpRecoveryCode r WHERE r.user.id = :userId")
    void deleteAllByUserId(@Param("userId") UUID userId);
}
