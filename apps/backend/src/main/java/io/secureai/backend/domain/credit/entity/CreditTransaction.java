package io.secureai.backend.domain.credit.entity;

import io.secureai.backend.domain.user.entity.User;
import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "credit_transactions")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class CreditTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** 양수 = 지급, 음수 = 차감 */
    @Column(nullable = false)
    private int delta;

    @Column(nullable = false, length = 50)
    private String reason;

    @Column
    private UUID sessionId;

    @Column(length = 60)
    private String model;

    @Column
    private Integer filesCount;

    @Column(nullable = false)
    private int balanceAfter;

    @Column(nullable = false, updatable = false)
    @Builder.Default
    private OffsetDateTime createdAt = OffsetDateTime.now();
}
