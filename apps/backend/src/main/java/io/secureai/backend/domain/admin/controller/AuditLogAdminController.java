package io.secureai.backend.domain.admin.controller;

import io.secureai.backend.domain.admin.dto.AuditVerifyResponse;
import io.secureai.backend.domain.admin.service.AuditVerifyService;
import io.secureai.backend.global.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 감사 로그 관리자 전용 엔드포인트.
 * SecurityConfig는 수정하지 않는다 — 관리자 인가는 @PreAuthorize + adminGuard로 처리.
 */
@RestController
@RequestMapping("/api/v1/admin/audit-logs")
@RequiredArgsConstructor
public class AuditLogAdminController {

    private final AuditVerifyService auditVerifyService;

    /**
     * GET /api/v1/admin/audit-logs/verify
     * 감사 로그 해시 체인 무결성 전체 검증.
     * 관리자 전용 — @adminGuard.check 로 권한 확인.
     *
     * @return valid=true(무결), false(위변조) + 첫 위변조 지점 id
     */
    @GetMapping("/verify")
    @PreAuthorize("@adminGuard.check(authentication)")
    public ResponseEntity<ApiResponse<AuditVerifyResponse>> verify() {
        AuditVerifyResponse result = auditVerifyService.verifyChain();
        return ResponseEntity.ok(ApiResponse.success(result));
    }
}
