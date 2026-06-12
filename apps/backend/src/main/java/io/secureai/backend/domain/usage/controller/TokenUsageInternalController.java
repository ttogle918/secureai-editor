package io.secureai.backend.domain.usage.controller;

import io.secureai.backend.domain.usage.dto.ReportTokenUsageRequest;
import io.secureai.backend.domain.usage.service.TokenUsageService;
import io.secureai.backend.global.response.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

/**
 * AI Engine → Backend 내부 토큰 사용량 적재 엔드포인트 (COST-3).
 *
 * 인증: X-Internal-Key (InternalKeyAuthFilter 경유).
 * URL prefix /api/v1/internal/** 에 의해 자동 적용됨.
 */
@RestController
@RequiredArgsConstructor
public class TokenUsageInternalController {

    private final TokenUsageService tokenUsageService;

    /**
     * 세션 종료 시 AI Engine이 1회 호출하는 토큰 사용량 적재 엔드포인트.
     *
     * POST /api/v1/internal/sessions/{sessionId}/token-usage
     */
    @PostMapping("/api/v1/internal/sessions/{sessionId}/token-usage")
    public ResponseEntity<ApiResponse<Map<String, String>>> reportTokenUsage(
            @PathVariable UUID sessionId,
            @Valid @RequestBody ReportTokenUsageRequest request) {

        tokenUsageService.record(sessionId, request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(Map.of("status", "recorded")));
    }
}
