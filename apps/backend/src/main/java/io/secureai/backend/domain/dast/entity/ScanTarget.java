package io.secureai.backend.domain.dast.entity;

import io.secureai.backend.global.entity.BaseTimeEntity;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "scan_targets")
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class ScanTarget extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "project_id", nullable = false)
    private UUID projectId;

    @Column(nullable = false, length = 255)
    private String domain;

    @Column(nullable = false)
    @Builder.Default
    private boolean verified = false;

    @Column(name = "verification_token", nullable = false, length = 64)
    private String verificationToken;

    @Column(name = "verified_at")
    private OffsetDateTime verifiedAt;

    @Column(name = "consent_given", nullable = false)
    @Builder.Default
    private boolean consentGiven = false;

    /**
     * 법적 증거 보존용 IP — 절대 로그 출력 금지.
     */
    @Column(name = "consent_ip", length = 45)
    private String consentIp;

    @Column(name = "consent_given_at")
    private OffsetDateTime consentGivenAt;

    /**
     * 면책 동의를 기록한다.
     * consentIp는 법적 증거 보존 데이터이므로 호출자는 로그에 출력하지 않는다.
     */
    public void recordConsent(String ip) {
        this.consentGiven = true;
        this.consentIp = ip;
        this.consentGivenAt = OffsetDateTime.now();
    }

    /** 도메인 소유권 확인 완료를 기록한다. */
    public void markVerified() {
        this.verified = true;
        this.verifiedAt = OffsetDateTime.now();
    }
}
