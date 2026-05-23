package io.secureai.backend.domain.monitoring.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * 지속 모니터링 체크 결과 엔티티.
 *
 * <p>파티션 테이블이므로 {@code BaseTimeEntity} 상속 금지.
 * {@code checkedAt} 이 파티션 키 역할을 하며 독립 필드로 관리한다.
 *
 * <p>status 값: UP / DOWN / SSL_EXPIRING / SSL_EXPIRED
 */
@Entity
@Table(name = "monitoring_results")
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MonitoringResult {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "scan_target_id", nullable = false)
    private UUID scanTargetId;

    @Column(name = "project_id", nullable = false)
    private UUID projectId;

    /** 체크 결과 상태: UP / DOWN / SSL_EXPIRING / SSL_EXPIRED */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MonitoringStatus status;

    @Column(name = "http_status_code")
    private Integer httpStatusCode;

    @Column(name = "response_time_ms")
    private Long responseTimeMs;

    @Column(name = "ssl_expires_at")
    private OffsetDateTime sslExpiresAt;

    @Column(name = "ssl_days_remaining")
    private Integer sslDaysRemaining;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    /** 파티션 키 — 레코드 체크 시각. */
    @Column(name = "checked_at", nullable = false)
    private OffsetDateTime checkedAt;
}
