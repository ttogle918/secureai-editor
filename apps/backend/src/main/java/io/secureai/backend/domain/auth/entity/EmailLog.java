package io.secureai.backend.domain.auth.entity;

import jakarta.persistence.*;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * 트랜잭션 이메일 발송 로그.
 *
 * 민감 데이터(토큰·링크 전체) 저장 금지 — subject·to·status 수준만 기록한다.
 */
@Entity
@Table(name = "email_log")
@Getter
@NoArgsConstructor
public class EmailLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "to_address", nullable = false, length = 254)
    private String toAddress;

    @Column(nullable = false, length = 998)
    private String subject;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private EmailStatus status;

    @Column(nullable = false, length = 32)
    private String provider;

    @Column(nullable = false)
    private int attempts;

    /** 오류 메시지 (FAILED 시에만). 스택 트레이스·내부 경로 포함 금지. */
    @Column(name = "error_message", length = 500)
    private String errorMessage;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Builder
    public EmailLog(String toAddress, String subject, EmailStatus status,
                    String provider, int attempts, String errorMessage) {
        this.toAddress = toAddress;
        this.subject = subject;
        this.status = status;
        this.provider = provider;
        this.attempts = attempts;
        this.errorMessage = errorMessage;
        this.createdAt = OffsetDateTime.now();
    }
}
