package io.secureai.backend.domain.sbom.controller;

import io.secureai.backend.domain.sbom.dto.SaveComponentsRequest;
import io.secureai.backend.domain.sbom.service.SbomService;
import io.secureai.backend.global.response.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * SBOM 컴포넌트 저장 API.
 *
 * AI Engine → Backend 내부 호출 전용 (X-Internal-Key 인증).
 * POST /api/v1/sbom/components
 */
@RestController
@RequiredArgsConstructor
public class SbomController {

    private final SbomService sbomService;

    /**
     * AI Engine 에서 파싱한 SBOM 컴포넌트 목록을 저장한다.
     */
    @PostMapping("/api/v1/sbom/components")
    public ResponseEntity<ApiResponse<Map<String, Integer>>> saveComponents(
            @Valid @RequestBody SaveComponentsRequest request) {
        int saved = sbomService.saveComponents(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(Map.of("saved", saved)));
    }
}
