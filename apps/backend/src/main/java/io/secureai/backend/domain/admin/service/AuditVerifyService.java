package io.secureai.backend.domain.admin.service;

import io.secureai.backend.domain.admin.dto.AuditVerifyResponse;
import io.secureai.backend.global.aop.AuditLogEntry;
import io.secureai.backend.global.aop.AuditLogHashService;
import io.secureai.backend.global.aop.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 감사 로그 해시 체인 무결성 검증 서비스.
 * created_at 오름차순으로 체인을 순회하며 각 행의 current_hash를 재계산해 저장값과 비교한다.
 */
@Service
@RequiredArgsConstructor
public class AuditVerifyService {

    private final AuditLogRepository auditLogRepository;
    private final AuditLogHashService hashService;

    /**
     * 전체 해시 체인을 검증한다.
     *
     * @return 검증 결과 — valid=true(정상) 또는 첫 위변조 지점 id 포함
     */
    @Transactional(readOnly = true)
    public AuditVerifyResponse verifyChain() {
        List<AuditLogEntry> entries = auditLogRepository.findAllWithHashOrderByCreatedAtAsc();

        if (entries.isEmpty()) {
            return AuditVerifyResponse.ok(0);
        }

        return traverse(entries);
    }

    private AuditVerifyResponse traverse(List<AuditLogEntry> entries) {
        String expectedPrevHash = AuditLogHashService.GENESIS_PREV_HASH;

        for (int i = 0; i < entries.size(); i++) {
            AuditLogEntry entry = entries.get(i);

            if (isTampered(entry, expectedPrevHash)) {
                return AuditVerifyResponse.tampered(i + 1L, entry.getId());
            }

            expectedPrevHash = entry.getCurrentHash();
        }

        return AuditVerifyResponse.ok(entries.size());
    }

    private boolean isTampered(AuditLogEntry entry, String expectedPrevHash) {
        boolean prevHashMismatch = !expectedPrevHash.equals(entry.getPrevHash());
        if (prevHashMismatch) {
            return true;
        }

        String recomputed = hashService.compute(entry.getPrevHash(), entry);
        return !recomputed.equals(entry.getCurrentHash());
    }
}
