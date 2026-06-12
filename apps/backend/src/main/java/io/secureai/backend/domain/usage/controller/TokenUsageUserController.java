package io.secureai.backend.domain.usage.controller;

import io.secureai.backend.domain.usage.dto.TokenUsageSummaryResponse;
import io.secureai.backend.domain.usage.service.TokenUsageService;
import io.secureai.backend.global.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * 사용자 토큰 사용량 조회 엔드포인트 (COST-3).
 *
 * 인증: JWT (@AuthenticationPrincipal UUID userId).
 * userId는 principal에서만 추출 — 타 사용자 조회 불가.
 *
 * 입력 검증: from, to 날짜 파라미터는 Controller에서 수행.
 */
@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class TokenUsageUserController {

    private static final int MAX_RANGE_DAYS = 93; // ~3개월

    private final TokenUsageService tokenUsageService;

    /**
     * GET /api/v1/users/me/token-usage?from=2026-06-01T00:00:00Z&to=2026-07-01T00:00:00Z
     *
     * 타 사용자 조회 시 principal 강제 적용으로 자동 차단.
     */
    @GetMapping("/me/token-usage")
    public ResponseEntity<ApiResponse<TokenUsageSummaryResponse>> getTokenUsage(
            @AuthenticationPrincipal UUID userId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime to) {

        // 입력 검증: Controller 레이어 책임
        if (from == null || to == null || !from.isBefore(to)) {
            throw new IllegalArgumentException("from must be before to");
        }
        long days = java.time.temporal.ChronoUnit.DAYS.between(from, to);
        if (days > MAX_RANGE_DAYS) {
            throw new IllegalArgumentException("Range must not exceed " + MAX_RANGE_DAYS + " days");
        }

        // userId = principal (타 사용자 조회 불가)
        TokenUsageSummaryResponse summary = tokenUsageService.getSummary(userId, from, to);
        return ResponseEntity.ok(ApiResponse.success(summary));
    }
}
