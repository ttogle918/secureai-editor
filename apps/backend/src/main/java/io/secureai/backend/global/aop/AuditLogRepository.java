package io.secureai.backend.global.aop;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AuditLogRepository extends JpaRepository<AuditLogEntry, UUID> {

    /**
     * 비관적 락으로 체인의 마지막(최신) 행을 읽어 prev_hash를 안전하게 가져온다.
     * 이 쿼리를 synchronized 블록 내 트랜잭션에서 호출해 동시 append를 직렬화한다.
     *
     * 왜 FOR UPDATE인가:
     * Virtual Threads 환경에서 두 스레드가 동시에 "마지막 행"을 조회하면 동일한
     * prev_hash를 기반으로 체인이 분기된다. FOR UPDATE 락으로 한 트랜잭션이 행을
     * 읽고 새 행을 INSERT하는 동안 다른 트랜잭션의 읽기를 차단해 직렬화를 보장한다.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT e FROM AuditLogEntry e WHERE e.currentHash IS NOT NULL ORDER BY e.createdAt DESC LIMIT 1")
    Optional<AuditLogEntry> findLatestWithHashForUpdate();

    /**
     * 해시 체인 무결성 검증을 위해 hash가 존재하는 행 전체를 created_at 오름차순으로 반환한다.
     * 전체 체인 순회가 목적이므로 락 없이 일관된 스냅샷 읽기.
     */
    @Query("SELECT e FROM AuditLogEntry e WHERE e.currentHash IS NOT NULL ORDER BY e.createdAt ASC")
    List<AuditLogEntry> findAllWithHashOrderByCreatedAtAsc();
}
