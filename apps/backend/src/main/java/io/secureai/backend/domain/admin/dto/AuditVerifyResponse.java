package io.secureai.backend.domain.admin.dto;

import java.util.UUID;

/**
 * GET /api/v1/admin/audit-logs/verify 응답 DTO.
 *
 * @param valid           체인 전체가 유효하면 true
 * @param totalChecked    검사한 행 수
 * @param firstTamperedId 위변조가 감지된 첫 번째 행의 id (유효하면 null)
 */
public record AuditVerifyResponse(
        boolean valid,
        long totalChecked,
        UUID firstTamperedId
) {

    public static AuditVerifyResponse ok(long totalChecked) {
        return new AuditVerifyResponse(true, totalChecked, null);
    }

    public static AuditVerifyResponse tampered(long totalChecked, UUID firstTamperedId) {
        return new AuditVerifyResponse(false, totalChecked, firstTamperedId);
    }
}
