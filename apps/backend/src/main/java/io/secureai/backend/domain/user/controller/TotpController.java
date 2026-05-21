package io.secureai.backend.domain.user.controller;

import io.secureai.backend.domain.user.dto.TotpSetupResponse;
import io.secureai.backend.domain.user.dto.TotpVerifyRequest;
import io.secureai.backend.domain.user.dto.TotpVerifyResponse;
import io.secureai.backend.domain.user.service.TotpService;
import io.secureai.backend.global.response.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * 2단계 인증(TOTP) 관리 엔드포인트.
 * 모든 요청은 JWT 인증이 필요하며, userId는 @AuthenticationPrincipal에서만 획득한다.
 */
@RestController
@RequestMapping("/api/v1/auth/2fa")
@RequiredArgsConstructor
public class TotpController {

    private final TotpService totpService;

    /**
     * TOTP 설정 초기화 — QR 코드 URL, secret, 복구 코드 8개 반환.
     * 이 시점에서 2FA가 활성화되지 않으며, /verify 호출 후 활성화된다.
     */
    @PostMapping("/setup")
    public ResponseEntity<ApiResponse<TotpSetupResponse>> setup(
            @AuthenticationPrincipal UUID userId) {
        return ResponseEntity.ok(ApiResponse.success(totpService.setupTotp(userId)));
    }

    /**
     * TOTP 코드 검증 및 2FA 활성화.
     * 유효한 코드 제출 시 totp_enabled = true로 변경된다.
     */
    @PostMapping("/verify")
    public ResponseEntity<ApiResponse<TotpVerifyResponse>> verify(
            @AuthenticationPrincipal UUID userId,
            @Valid @RequestBody TotpVerifyRequest request) {
        return ResponseEntity.ok(ApiResponse.success(totpService.verifyAndEnable(userId, request.code())));
    }

    /**
     * 2FA 비활성화 — secret 및 복구 코드 전체 삭제.
     */
    @DeleteMapping
    public ResponseEntity<Void> disable(@AuthenticationPrincipal UUID userId) {
        totpService.disable(userId);
        return ResponseEntity.noContent().build();
    }
}
