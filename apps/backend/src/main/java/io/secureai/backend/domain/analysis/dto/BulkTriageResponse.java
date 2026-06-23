package io.secureai.backend.domain.analysis.dto;

import java.util.List;
import java.util.UUID;

/**
 * 벌크 트리아지 결과 DTO.
 *
 * <p>소유하지 않았거나 존재하지 않는 취약점은 조용히 skip 되며 skipped 로 집계된다
 * (타 사용자 취약점 존재 여부를 노출하지 않기 위함). 프론트는 appliedVulnIds 로
 * 낙관적 갱신을 동기화한다.
 *
 * @param requested      요청된(중복 제거 후) 취약점 수
 * @param applied        실제 적용된 수
 * @param skipped        미적용(미존재/권한없음) 수 = requested - applied
 * @param newStatus      적용된 새 상태 (open | false_positive | fixed)
 * @param appliedVulnIds 실제 적용된 취약점 ID 목록
 */
public record BulkTriageResponse(
        int requested,
        int applied,
        int skipped,
        String newStatus,
        List<UUID> appliedVulnIds
) {}
