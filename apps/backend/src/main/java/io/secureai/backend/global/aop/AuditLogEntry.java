package io.secureai.backend.global.aop;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * 감사 로그 엔티티.
 * immutable 레코드이므로 BaseTimeEntity 상속 없이 createdAt만 보유한다.
 * prev_hash/current_hash 쌍으로 SHA-256 해시 체인을 형성한다.
 */
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "audit_logs")
public class AuditLogEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** 요청을 수행한 사용자 ID. 익명 요청이거나 사용자 탈퇴 후에도 보존하기 위해 nullable, FK 없음. */
    @Column(name = "actor_id")
    private UUID actorId;

    @Column(name = "action", nullable = false, length = 100)
    private String action;

    @Column(name = "resource", length = 100)
    private String resource;

    /** IPv4 또는 IPv6 주소 (최대 45자). 1단계에서는 null로 저장. */
    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    /** 요청 결과. SUCCESS(정상 반환) / FAILURE(예외 발생). */
    @Column(name = "outcome", nullable = false, length = 10)
    private String outcome;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    /**
     * 직전 로그의 current_hash. genesis 로그는 64자 '0'으로 채운다.
     * 마이그레이션 이전 기존 행은 NULL.
     */
    @Column(name = "prev_hash", length = 64)
    private String prevHash;

    /**
     * SHA-256(prevHash || canonicalPayload) 결과값 (hex 64자).
     * 마이그레이션 이전 기존 행은 NULL.
     */
    @Column(name = "current_hash", length = 64)
    private String currentHash;

    /**
     * JPA @PrePersist 콜백.
     * AuditLogAspect에서 draft 엔트리의 createdAt을 미리 고정할 때도 직접 호출된다.
     * public으로 선언해 Aspect가 직접 호출 가능하도록 한다.
     */
    @PrePersist
    public void onCreate() {
        if (this.createdAt == null) {
            // PostgreSQL TIMESTAMPTZ와의 해시 정합성을 위해 마이크로초 단위로 절사
            this.createdAt = OffsetDateTime.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS);
        }
    }
}
