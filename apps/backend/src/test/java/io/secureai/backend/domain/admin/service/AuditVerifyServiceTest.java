package io.secureai.backend.domain.admin.service;

import io.secureai.backend.domain.admin.dto.AuditVerifyResponse;
import io.secureai.backend.global.aop.AuditLogEntry;
import io.secureai.backend.global.aop.AuditLogHashService;
import io.secureai.backend.global.aop.AuditLogRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * AuditVerifyService 단위 테스트.
 * 정상 체인 PASS / 중간 위변조 감지 / 빈 체인 처리를 검증한다.
 * (백로그 테스트 체크리스트: 🧪 중간 로그 위변조 시 무결성 검증 API에서 감지)
 */
@ExtendWith(MockitoExtension.class)
class AuditVerifyServiceTest {

    @Mock
    private AuditLogRepository auditLogRepository;

    private AuditLogHashService hashService;
    private AuditVerifyService verifyService;

    @BeforeEach
    void setUp() {
        hashService = new AuditLogHashService();
        verifyService = new AuditVerifyService(auditLogRepository, hashService);
    }

    // ── 정상 체인 ────────────────────────────────────────────────────────────

    @Test
    @DisplayName("비어있는 체인은 valid=true, totalChecked=0 반환")
    void verifyChain_emptyChain_returnsValidZero() {
        when(auditLogRepository.findAllWithHashOrderByCreatedAtAsc()).thenReturn(List.of());

        AuditVerifyResponse result = verifyService.verifyChain();

        assertThat(result.valid()).isTrue();
        assertThat(result.totalChecked()).isZero();
        assertThat(result.firstTamperedId()).isNull();
    }

    @Test
    @DisplayName("올바른 해시 체인(3개) 전체가 valid=true 반환")
    void verifyChain_validChain_returnsValidWithCount() {
        List<AuditLogEntry> chain = buildValidChain(3);
        when(auditLogRepository.findAllWithHashOrderByCreatedAtAsc()).thenReturn(chain);

        AuditVerifyResponse result = verifyService.verifyChain();

        assertThat(result.valid()).isTrue();
        assertThat(result.totalChecked()).isEqualTo(3);
        assertThat(result.firstTamperedId()).isNull();
    }

    @Test
    @DisplayName("단일 genesis 엔트리 체인은 valid=true 반환")
    void verifyChain_singleGenesisEntry_returnsValid() {
        List<AuditLogEntry> chain = buildValidChain(1);
        when(auditLogRepository.findAllWithHashOrderByCreatedAtAsc()).thenReturn(chain);

        AuditVerifyResponse result = verifyService.verifyChain();

        assertThat(result.valid()).isTrue();
        assertThat(result.totalChecked()).isEqualTo(1);
    }

    // ── 위변조 감지 ──────────────────────────────────────────────────────────

    @Test
    @DisplayName("중간(2번째) 엔트리의 action을 변조하면 해당 지점을 firstTamperedId로 반환")
    void verifyChain_middleEntryActionTampered_detectsTamperedEntry() {
        List<AuditLogEntry> chain = buildValidChain(3);

        // 2번째 엔트리의 action 값을 변조 (current_hash는 그대로 — 위변조 시뮬레이션)
        AuditLogEntry tampered = tamperedEntry(chain.get(1), "TAMPERED_ACTION");
        List<AuditLogEntry> tamperedChain = new ArrayList<>(chain);
        tamperedChain.set(1, tampered);

        when(auditLogRepository.findAllWithHashOrderByCreatedAtAsc()).thenReturn(tamperedChain);

        AuditVerifyResponse result = verifyService.verifyChain();

        assertThat(result.valid()).isFalse();
        assertThat(result.firstTamperedId()).isEqualTo(tampered.getId());
        assertThat(result.totalChecked()).isEqualTo(2); // 위변조 지점에서 중단
    }

    @Test
    @DisplayName("첫 번째(genesis) 엔트리를 변조하면 즉시 감지")
    void verifyChain_genesisEntryTampered_detectsImmediately() {
        List<AuditLogEntry> chain = buildValidChain(3);

        AuditLogEntry tampered = tamperedEntry(chain.get(0), "TAMPERED");
        List<AuditLogEntry> tamperedChain = new ArrayList<>(chain);
        tamperedChain.set(0, tampered);

        when(auditLogRepository.findAllWithHashOrderByCreatedAtAsc()).thenReturn(tamperedChain);

        AuditVerifyResponse result = verifyService.verifyChain();

        assertThat(result.valid()).isFalse();
        assertThat(result.firstTamperedId()).isEqualTo(tampered.getId());
        assertThat(result.totalChecked()).isEqualTo(1);
    }

    @Test
    @DisplayName("마지막 엔트리를 변조하면 마지막 지점을 감지")
    void verifyChain_lastEntryTampered_detectsLastEntry() {
        List<AuditLogEntry> chain = buildValidChain(3);

        int lastIdx = chain.size() - 1;
        AuditLogEntry tampered = tamperedEntry(chain.get(lastIdx), "TAMPERED_LAST");
        List<AuditLogEntry> tamperedChain = new ArrayList<>(chain);
        tamperedChain.set(lastIdx, tampered);

        when(auditLogRepository.findAllWithHashOrderByCreatedAtAsc()).thenReturn(tamperedChain);

        AuditVerifyResponse result = verifyService.verifyChain();

        assertThat(result.valid()).isFalse();
        assertThat(result.firstTamperedId()).isEqualTo(tampered.getId());
        assertThat(result.totalChecked()).isEqualTo(3);
    }

    @Test
    @DisplayName("prev_hash 값이 조작(체인 링크 끊김)되면 감지")
    void verifyChain_prevHashManipulated_detectsTamperedEntry() {
        List<AuditLogEntry> chain = buildValidChain(3);

        // 2번째 엔트리의 prevHash를 잘못된 값으로 교체
        AuditLogEntry broken = brokenPrevHash(chain.get(1), "b".repeat(64));
        List<AuditLogEntry> brokenChain = new ArrayList<>(chain);
        brokenChain.set(1, broken);

        when(auditLogRepository.findAllWithHashOrderByCreatedAtAsc()).thenReturn(brokenChain);

        AuditVerifyResponse result = verifyService.verifyChain();

        assertThat(result.valid()).isFalse();
        assertThat(result.firstTamperedId()).isEqualTo(broken.getId());
    }

    // ── 헬퍼 — 올바른 체인 생성 ─────────────────────────────────────────────

    /**
     * 실제 SHA-256 해시 체인을 가진 AuditLogEntry 목록을 생성한다.
     * 첫 번째 엔트리는 genesis(prevHash=64자 '0').
     */
    private List<AuditLogEntry> buildValidChain(int size) {
        List<AuditLogEntry> chain = new ArrayList<>();
        String prevHash = AuditLogHashService.GENESIS_PREV_HASH;

        for (int i = 0; i < size; i++) {
            OffsetDateTime time = OffsetDateTime.parse("2026-01-01T00:00:00+00:00").plusSeconds(i);
            AuditLogEntry draft = AuditLogEntry.builder()
                    .actorId(UUID.randomUUID())
                    .action("ACTION_" + i)
                    .resource("resource")
                    .outcome("SUCCESS")
                    .createdAt(time)
                    .build();

            String currentHash = hashService.compute(prevHash, draft);
            AuditLogEntry entry = withHashFields(draft, prevHash, currentHash);
            chain.add(entry);
            prevHash = currentHash;
        }
        return chain;
    }

    /** action만 변조하고 hash는 그대로 유지 — 위변조 시뮬레이션. */
    private AuditLogEntry tamperedEntry(AuditLogEntry original, String newAction) {
        AuditLogEntry tampered = AuditLogEntry.builder()
                .actorId(original.getActorId())
                .action(newAction)
                .resource(original.getResource())
                .outcome(original.getOutcome())
                .createdAt(original.getCreatedAt())
                .prevHash(original.getPrevHash())
                .currentHash(original.getCurrentHash())
                .build();
        // id 필드 복사 (private final — ReflectionTestUtils 사용)
        ReflectionTestUtils.setField(tampered, "id", original.getId());
        return tampered;
    }

    /** prevHash만 교체 — 체인 링크 끊김 시뮬레이션. */
    private AuditLogEntry brokenPrevHash(AuditLogEntry original, String badPrevHash) {
        AuditLogEntry broken = AuditLogEntry.builder()
                .actorId(original.getActorId())
                .action(original.getAction())
                .resource(original.getResource())
                .outcome(original.getOutcome())
                .createdAt(original.getCreatedAt())
                .prevHash(badPrevHash)
                .currentHash(original.getCurrentHash())
                .build();
        ReflectionTestUtils.setField(broken, "id", original.getId());
        return broken;
    }

    /** draft에 prevHash/currentHash를 추가해 완성된 엔트리를 반환한다. */
    private AuditLogEntry withHashFields(AuditLogEntry draft, String prevHash, String currentHash) {
        AuditLogEntry entry = AuditLogEntry.builder()
                .actorId(draft.getActorId())
                .action(draft.getAction())
                .resource(draft.getResource())
                .outcome(draft.getOutcome())
                .createdAt(draft.getCreatedAt())
                .prevHash(prevHash)
                .currentHash(currentHash)
                .build();
        ReflectionTestUtils.setField(entry, "id", UUID.randomUUID());
        return entry;
    }
}
