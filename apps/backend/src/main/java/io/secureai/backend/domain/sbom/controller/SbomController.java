package io.secureai.backend.domain.sbom.controller;

import io.secureai.backend.domain.sbom.dto.CycloneDxBom;
import io.secureai.backend.domain.sbom.dto.SaveComponentsRequest;
import io.secureai.backend.domain.sbom.dto.SbomComponentResponse;
import io.secureai.backend.domain.sbom.service.CycloneDxExportService;
import io.secureai.backend.domain.sbom.service.SbomService;
import io.secureai.backend.global.response.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * SBOM 컴포넌트 API.
 *
 * POST /api/v1/internal/sbom/components                 — AI Engine → Backend 내부 호출 전용 (X-Internal-Key 인증, InternalKeyAuthFilter)
 * GET  /api/v1/projects/{projectId}/sbom/components     — 인증된 사용자 전용
 * GET  /api/v1/projects/{projectId}/sbom/cyclonedx      — CycloneDX 1.4 JSON 내보내기 (인증된 사용자 전용)
 */
@RestController
@RequiredArgsConstructor
public class SbomController {

    private final SbomService sbomService;
    private final CycloneDxExportService cycloneDxExportService;

    /**
     * AI Engine 에서 파싱한 SBOM 컴포넌트 목록을 저장한다.
     *
     * <p>내부 전용 경로(/api/v1/internal/**)에 위치하여 InternalKeyAuthFilter의
     * X-Internal-Key 검증을 통과해야만 접근할 수 있다(외부 무인증 호출 차단).
     */
    @PostMapping("/api/v1/internal/sbom/components")
    public ResponseEntity<ApiResponse<Map<String, Integer>>> saveComponents(
            @Valid @RequestBody SaveComponentsRequest request) {
        int saved = sbomService.saveComponents(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(Map.of("saved", saved)));
    }

    /**
     * 특정 프로젝트·세션의 SBOM 컴포넌트 목록을 조회한다.
     *
     * <p>인증된 사용자만 접근 가능하며, 프로젝트 팀 멤버 여부를 서비스 레이어에서 검증한다.
     *
     * @param projectId 경로 변수 — 프로젝트 ID
     * @param sessionId 쿼리 파라미터 — 분석 세션 ID
     * @param userId    Spring Security Principal — Access Token에서 추출된 사용자 ID
     */
    @GetMapping("/api/v1/projects/{projectId}/sbom/components")
    public ResponseEntity<ApiResponse<List<SbomComponentResponse>>> getComponents(
            @PathVariable UUID projectId,
            @RequestParam UUID sessionId,
            @AuthenticationPrincipal UUID userId) {
        List<SbomComponentResponse> components = sbomService.getComponents(projectId, sessionId, userId);
        return ResponseEntity.ok(ApiResponse.success(components));
    }

    /**
     * 특정 프로젝트·세션의 SBOM 을 CycloneDX 1.4 JSON 포맷으로 내보낸다.
     *
     * <p>인증된 사용자만 접근 가능하며, 프로젝트 팀 멤버 여부를 서비스 레이어에서 검증한다.
     * CVE 매칭 결과가 vulnerabilities 필드에 선택적으로 포함된다.
     *
     * @param projectId 경로 변수 — 프로젝트 ID
     * @param sessionId 쿼리 파라미터 — 분석 세션 ID
     * @param userId    Spring Security Principal — Access Token에서 추출된 사용자 ID
     */
    @GetMapping("/api/v1/projects/{projectId}/sbom/cyclonedx")
    public ResponseEntity<ApiResponse<CycloneDxBom>> exportCycloneDx(
            @PathVariable UUID projectId,
            @RequestParam UUID sessionId,
            @AuthenticationPrincipal UUID userId) {
        CycloneDxBom bom = cycloneDxExportService.exportCycloneDx(projectId, sessionId, userId);
        return ResponseEntity.ok(ApiResponse.success(bom));
    }
}
