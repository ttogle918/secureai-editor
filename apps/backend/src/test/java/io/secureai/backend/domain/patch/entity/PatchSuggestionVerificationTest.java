package io.secureai.backend.domain.patch.entity;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.*;

/**
 * PatchSuggestion 검증 상태 전이 단위 테스트 (TASK-1402).
 *
 * 테스트 대상:
 * - markVerified() → VERIFIED 전이, verifiedAt 기록
 * - markFailed()   → FAILED 전이, verifiedAt 기록
 * - 초기 상태는 PENDING
 * - 상수값이 DB CHECK 제약과 일치
 */
class PatchSuggestionVerificationTest {

    private PatchSuggestion patch;

    @BeforeEach
    void setUp() {
        patch = PatchSuggestion.builder()
                .filePath("src/main/python/app.py")
                .vulnType("SQL_INJECTION")
                .build();
    }

    @Test
    @DisplayName("초기 verificationStatus 는 PENDING 이다")
    void initialStatus_isPending() {
        assertThat(patch.getVerificationStatus())
                .isEqualTo(PatchSuggestion.VerificationStatus.PENDING);
        assertThat(patch.getVerifiedAt()).isNull();
    }

    @Test
    @DisplayName("markVerified() 호출 시 VERIFIED 로 전이되고 verifiedAt 이 기록된다")
    void markVerified_transitionsToVerified() {
        patch.markVerified("def test_fix(): assert True", "1 passed in 0.01s");

        assertThat(patch.getVerificationStatus())
                .isEqualTo(PatchSuggestion.VerificationStatus.VERIFIED);
        assertThat(patch.getVerifiedAt()).isNotNull();
        assertThat(patch.getTestCode()).isEqualTo("def test_fix(): assert True");
        assertThat(patch.getVerificationLog()).isEqualTo("1 passed in 0.01s");
    }

    @Test
    @DisplayName("markFailed() 호출 시 FAILED 로 전이되고 verifiedAt 이 기록된다")
    void markFailed_transitionsToFailed() {
        patch.markFailed("SyntaxError: invalid syntax");

        assertThat(patch.getVerificationStatus())
                .isEqualTo(PatchSuggestion.VerificationStatus.FAILED);
        assertThat(patch.getVerifiedAt()).isNotNull();
        assertThat(patch.getVerificationLog()).isEqualTo("SyntaxError: invalid syntax");
    }

    @Test
    @DisplayName("markVerified() 에 null testCode / log 를 전달해도 전이는 정상 동작한다")
    void markVerified_withNullParams_succeeds() {
        patch.markVerified(null, null);

        assertThat(patch.getVerificationStatus())
                .isEqualTo(PatchSuggestion.VerificationStatus.VERIFIED);
        assertThat(patch.getVerifiedAt()).isNotNull();
        assertThat(patch.getTestCode()).isNull();
        assertThat(patch.getVerificationLog()).isNull();
    }

    @Test
    @DisplayName("markFailed() 에 null log 를 전달해도 전이는 정상 동작한다")
    void markFailed_withNullLog_succeeds() {
        patch.markFailed(null);

        assertThat(patch.getVerificationStatus())
                .isEqualTo(PatchSuggestion.VerificationStatus.FAILED);
        assertThat(patch.getVerifiedAt()).isNotNull();
    }

    @Test
    @DisplayName("VerificationStatus 상수가 DB CHECK 제약과 일치한다")
    void verificationStatusConstants_matchDbCheck() {
        assertThat(PatchSuggestion.VerificationStatus.PENDING).isEqualTo("PENDING");
        assertThat(PatchSuggestion.VerificationStatus.VERIFIED).isEqualTo("VERIFIED");
        assertThat(PatchSuggestion.VerificationStatus.FAILED).isEqualTo("FAILED");
    }
}
