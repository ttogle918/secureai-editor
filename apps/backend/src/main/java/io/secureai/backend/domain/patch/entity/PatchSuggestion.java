package io.secureai.backend.domain.patch.entity;

import io.secureai.backend.domain.analysis.entity.AnalysisSession;
import io.secureai.backend.domain.analysis.entity.Vulnerability;
import io.secureai.backend.domain.user.entity.User;
import io.secureai.backend.global.entity.BaseTimeEntity;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * 패치 제안 엔티티.
 *
 * verification_status: PENDING(기본) / VERIFIED / FAILED
 * - markVerified(): 검증 성공 전이 (PENDING → VERIFIED)
 * - markFailed()  : 검증 실패 전이 (PENDING → FAILED)
 * 상태 전이는 도메인 메서드만 사용한다 (직접 setter 금지).
 */

@Entity
@Table(
    name = "patch_suggestions",
    indexes = {
        @Index(name = "idx_patch_session",   columnList = "session_id"),
        @Index(name = "idx_patch_vuln",      columnList = "vuln_id"),
        @Index(name = "idx_patch_cache_key", columnList = "cache_key")
    }
)
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class PatchSuggestion extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false)
    private AnalysisSession session;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "vuln_id")
    private Vulnerability vulnerability;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String filePath;

    @Column(nullable = false, length = 50)
    private String vulnType;

    @Column(columnDefinition = "TEXT")
    private String originalSnippet;

    @Column(columnDefinition = "TEXT")
    private String patchedSnippet;

    @Column(columnDefinition = "TEXT")
    private String unifiedDiff;

    @Column(columnDefinition = "TEXT")
    private String explanation;

    @Column(length = 200)
    private String cacheKey;

    @Column(nullable = false)
    @Builder.Default
    private Boolean isApplied = false;

    private OffsetDateTime appliedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "applied_by")
    private User appliedBy;

    // ─── Verification (TASK-1402) ────────────────────────────────────────────

    /** 검증 상태 — 허용값: PENDING / VERIFIED / FAILED (V061 CHECK 제약) */
    @Column(nullable = false, length = 10)
    @Builder.Default
    private String verificationStatus = VerificationStatus.PENDING;

    /** 검증 완료(VERIFIED 또는 FAILED) 시각 */
    private OffsetDateTime verifiedAt;

    /** Claude가 생성한 임시 pytest 테스트 코드 (감사 목적 보존) — 민감 페이로드 금지 */
    @Column(columnDefinition = "TEXT")
    private String testCode;

    /** 컨테이너 실행 로그 요약 — 민감 정보 금지 */
    @Column(columnDefinition = "TEXT")
    private String verificationLog;

    // ─── Domain Methods ──────────────────────────────────────────────────────

    public void apply(User user) {
        this.isApplied = true;
        this.appliedAt = OffsetDateTime.now();
        this.appliedBy = user;
    }

    /**
     * 패치 검증 성공으로 전이한다. PENDING → VERIFIED.
     * testCode / log 는 감사 목적으로 저장한다 (민감 페이로드 포함 금지).
     *
     * @param testCode  생성된 pytest 코드 (null 허용)
     * @param log       실행 로그 요약 (null 허용)
     */
    public void markVerified(String testCode, String log) {
        this.verificationStatus = VerificationStatus.VERIFIED;
        this.verifiedAt = OffsetDateTime.now();
        this.testCode = testCode;
        this.verificationLog = log;
    }

    /**
     * 패치 검증 실패로 전이한다. PENDING → FAILED.
     *
     * @param log 실패 사유 로그 (null 허용)
     */
    public void markFailed(String log) {
        this.verificationStatus = VerificationStatus.FAILED;
        this.verifiedAt = OffsetDateTime.now();
        this.verificationLog = log;
    }

    // ─── Constants ──────────────────────────────────────────────────────────

    /** verification_status 허용값 상수. DB CHECK 제약과 동일하게 유지한다. */
    public static final class VerificationStatus {
        public static final String PENDING  = "PENDING";
        public static final String VERIFIED = "VERIFIED";
        public static final String FAILED   = "FAILED";

        private VerificationStatus() {}
    }
}
