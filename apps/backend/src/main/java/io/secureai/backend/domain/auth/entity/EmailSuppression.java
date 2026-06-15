package io.secureai.backend.domain.auth.entity;

import jakarta.persistence.*;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * 바운스/스팸 신고로 수신 거부 처리된 이메일 주소 억제 목록.
 *
 * 이 목록에 등록된 주소로는 발송을 스킵하고 SUPPRESSED 로그를 남긴다.
 */
@Entity
@Table(
    name = "email_suppression",
    uniqueConstraints = @UniqueConstraint(name = "uq_email_suppression_address", columnNames = "email_address")
)
@Getter
@NoArgsConstructor
public class EmailSuppression {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "email_address", nullable = false, length = 254)
    private String emailAddress;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private SuppressionReason reason;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Builder
    public EmailSuppression(String emailAddress, SuppressionReason reason) {
        this.emailAddress = emailAddress;
        this.reason = reason;
        this.createdAt = OffsetDateTime.now();
    }
}
