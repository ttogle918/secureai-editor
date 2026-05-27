package io.secureai.backend.domain.compliance.controller;

import io.secureai.backend.domain.compliance.dto.ComplianceResponse;
import io.secureai.backend.domain.compliance.service.ComplianceMappingService;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import io.secureai.backend.global.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * 컴플라이언스 프레임워크 매핑 API.
 *
 * <p>Base: {@code /api/v1/projects/{projectId}/sessions/{sessionId}/compliance}
 */
@RestController
@RequestMapping("/api/v1/projects/{projectId}/sessions/{sessionId}/compliance")
@RequiredArgsConstructor
public class ComplianceController {

    private final ComplianceMappingService complianceMappingService;

    /**
     * 세션 취약점의 컴플라이언스 프레임워크 매핑 결과를 반환한다.
     *
     * <p>framework 파라미터 유효성 검증은 이 Controller에서만 수행한다.
     *
     * @param projectId  프로젝트 ID
     * @param sessionId  분석 세션 ID
     * @param framework  "ISO27001" 또는 "NIST_CSF" (기본값: ISO27001)
     * @param userId     인증된 사용자 ID
     */
    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<ComplianceResponse>> getCompliance(
            @PathVariable UUID projectId,
            @PathVariable UUID sessionId,
            @RequestParam(defaultValue = "ISO27001") String framework,
            @AuthenticationPrincipal UUID userId
    ) {
        // 사용자 입력 검증 — Controller 레이어 전담 (Service 재검증 금지)
        if (!ComplianceMappingService.FRAMEWORK_ISO27001.equals(framework)
                && !ComplianceMappingService.FRAMEWORK_NIST_CSF.equals(framework)) {
            throw new BusinessException(ErrorCode.INVALID_INPUT);
        }

        ComplianceResponse report = complianceMappingService.getComplianceReport(
                projectId, sessionId, framework, userId);
        return ResponseEntity.ok(ApiResponse.success(report));
    }
}
