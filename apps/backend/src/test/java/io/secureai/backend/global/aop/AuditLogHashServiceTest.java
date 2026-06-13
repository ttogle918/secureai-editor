package io.secureai.backend.global.aop;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;

/**
 * AuditLogHashService 단위 테스트.
 * SHA-256 해시 계산의 결정론성, genesis 처리, canonical payload 직렬화를 검증한다.
 */
class AuditLogHashServiceTest {

    private AuditLogHashService hashService;

    @BeforeEach
    void setUp() {
        hashService = new AuditLogHashService();
    }

    // ── canonical payload 결정론성 ───────────────────────────────────────────

    @Test
    @DisplayName("동일한 엔트리로 두 번 호출하면 동일한 해시를 반환한다")
    void compute_sameEntry_returnsSameHash() {
        AuditLogEntry entry = buildEntry(UUID.randomUUID(), "ACTION", "resource", "SUCCESS",
                OffsetDateTime.parse("2026-01-01T00:00:00+00:00"));

        String hash1 = hashService.compute(AuditLogHashService.GENESIS_PREV_HASH, entry);
        String hash2 = hashService.compute(AuditLogHashService.GENESIS_PREV_HASH, entry);

        assertThat(hash1).isEqualTo(hash2);
    }

    @Test
    @DisplayName("action이 다르면 해시도 달라진다")
    void compute_differentAction_returnsDifferentHash() {
        OffsetDateTime now = OffsetDateTime.parse("2026-01-01T00:00:00+00:00");
        UUID actorId = UUID.randomUUID();

        AuditLogEntry entry1 = buildEntry(actorId, "ACTION_A", "resource", "SUCCESS", now);
        AuditLogEntry entry2 = buildEntry(actorId, "ACTION_B", "resource", "SUCCESS", now);

        String hash1 = hashService.compute(AuditLogHashService.GENESIS_PREV_HASH, entry1);
        String hash2 = hashService.compute(AuditLogHashService.GENESIS_PREV_HASH, entry2);

        assertThat(hash1).isNotEqualTo(hash2);
    }

    @Test
    @DisplayName("prevHash가 다르면 current_hash도 달라진다")
    void compute_differentPrevHash_returnsDifferentHash() {
        AuditLogEntry entry = buildEntry(UUID.randomUUID(), "ACTION", "res", "SUCCESS",
                OffsetDateTime.parse("2026-01-01T00:00:00+00:00"));

        String hash1 = hashService.compute(AuditLogHashService.GENESIS_PREV_HASH, entry);
        String hash2 = hashService.compute("a".repeat(64), entry);

        assertThat(hash1).isNotEqualTo(hash2);
    }

    @Test
    @DisplayName("반환값은 hex 소문자 64자 SHA-256이다")
    void compute_returnsHex64Chars() {
        AuditLogEntry entry = buildEntry(UUID.randomUUID(), "A", "B", "SUCCESS",
                OffsetDateTime.parse("2026-01-01T00:00:00+00:00"));

        String hash = hashService.compute(AuditLogHashService.GENESIS_PREV_HASH, entry);

        assertThat(hash).hasSize(64)
                .matches("[0-9a-f]+");
    }

    @Test
    @DisplayName("actorId=null, resource=null 인 경우에도 해시가 계산된다")
    void compute_withNullFields_returnsHash() {
        AuditLogEntry entry = buildEntry(null, "ANON_ACTION", null, "SUCCESS",
                OffsetDateTime.parse("2026-01-01T00:00:00+00:00"));

        assertThatCode(() -> hashService.compute(AuditLogHashService.GENESIS_PREV_HASH, entry))
                .doesNotThrowAnyException();
    }

    // ── genesis 고정값 검증 ──────────────────────────────────────────────────

    @Test
    @DisplayName("GENESIS_PREV_HASH는 64자 '0'이다")
    void genesisPrevHash_is64Zeros() {
        assertThat(AuditLogHashService.GENESIS_PREV_HASH)
                .hasSize(64)
                .matches("0+");
    }

    // ── canonical payload 직렬화 검증 ────────────────────────────────────────

    @Test
    @DisplayName("canonical payload는 pipe(|) 구분자로 5개 필드를 결합한다")
    void buildCanonicalPayload_hasFiveFieldsWithPipeSeparator() {
        UUID actorId = UUID.randomUUID();
        OffsetDateTime time = OffsetDateTime.parse("2026-01-01T00:00:00+00:00");
        AuditLogEntry entry = buildEntry(actorId, "MY_ACTION", "my-resource", "SUCCESS", time);

        String payload = hashService.buildCanonicalPayload(entry);

        assertThat(payload).contains("|");
        String[] parts = payload.split("\\|", -1);
        assertThat(parts).hasSize(5);
        assertThat(parts[0]).isEqualTo(actorId.toString());
        assertThat(parts[1]).isEqualTo("MY_ACTION");
        assertThat(parts[2]).isEqualTo("my-resource");
        assertThat(parts[3]).isEqualTo("SUCCESS");
        assertThat(parts[4]).contains("2026-01-01");
    }

    // ── 헬퍼 ────────────────────────────────────────────────────────────────

    private AuditLogEntry buildEntry(UUID actorId, String action, String resource,
                                     String outcome, OffsetDateTime createdAt) {
        return AuditLogEntry.builder()
                .actorId(actorId)
                .action(action)
                .resource(resource)
                .outcome(outcome)
                .createdAt(createdAt)
                .build();
    }
}
