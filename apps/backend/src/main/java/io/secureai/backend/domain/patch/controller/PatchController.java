package io.secureai.backend.domain.patch.controller;

import io.secureai.backend.domain.patch.dto.PatchSuggestionResponse;
import io.secureai.backend.domain.patch.dto.SavePatchResultsRequest;
import io.secureai.backend.domain.patch.service.PatchService;
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

@RestController
@RequiredArgsConstructor
public class PatchController {

    private final PatchService patchService;

    /** AI Engine → Backend 내부 엔드포인트 (X-Internal-Key 인증) */
    @PostMapping("/api/v1/internal/patches")
    public ResponseEntity<ApiResponse<Map<String, Integer>>> saveFromAgent(
            @Valid @RequestBody SavePatchResultsRequest request) {
        int saved = patchService.savePatchResults(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(Map.of("saved", saved)));
    }

    /** 세션별 패치 제안 목록 조회 (인증 필요) */
    @GetMapping("/api/v1/sessions/{sessionId}/patches")
    public ResponseEntity<ApiResponse<List<PatchSuggestionResponse>>> listPatches(
            @PathVariable UUID sessionId) {
        return ResponseEntity.ok(ApiResponse.success(patchService.listBySession(sessionId)));
    }

    /** 패치 적용 처리 (인증 필요) */
    @PostMapping("/api/v1/patches/{patchId}/apply")
    public ResponseEntity<ApiResponse<PatchSuggestionResponse>> applyPatch(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID patchId) {
        return ResponseEntity.ok(ApiResponse.success(patchService.applyPatch(userId, patchId)));
    }
}
