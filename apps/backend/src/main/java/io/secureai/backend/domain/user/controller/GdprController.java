package io.secureai.backend.domain.user.controller;

import io.secureai.backend.domain.user.dto.GdprDeleteRequest;
import io.secureai.backend.domain.user.dto.GdprExportResponse;
import io.secureai.backend.domain.user.service.GdprService;
import io.secureai.backend.global.response.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * GDPR 데이터 이동권·삭제권 엔드포인트.
 *
 * <p>userId는 반드시 {@code @AuthenticationPrincipal}에서만 획득한다.
 * 경로 파라미터나 요청 바디에서 userId를 받지 않아 타 사용자 데이터 접근을 원천 차단한다.
 */
@RestController
@RequestMapping("/api/v1/users/me/gdpr")
@RequiredArgsConstructor
public class GdprController {

    private final GdprService gdprService;

    /**
     * 현재 인증된 사용자의 전체 개인 데이터를 JSON으로 반환한다.
     *
     * <p>POST /api/v1/users/me/gdpr/export
     */
    @PostMapping("/export")
    public ResponseEntity<ApiResponse<GdprExportResponse>> exportData(
            @AuthenticationPrincipal UUID userId) {
        GdprExportResponse response = gdprService.exportData(userId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    /**
     * 현재 인증된 사용자의 계정 및 모든 관련 데이터를 즉시 하드 삭제한다.
     *
     * <p>POST /api/v1/users/me/gdpr/delete
     */
    @PostMapping("/delete")
    public ResponseEntity<Void> deleteAccount(
            @AuthenticationPrincipal UUID userId,
            @Valid @RequestBody GdprDeleteRequest request) {
        gdprService.deleteAccount(userId, request.confirmPassword());
        return ResponseEntity.noContent().build();
    }
}
