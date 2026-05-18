package io.secureai.backend.domain.notification.controller;

import io.secureai.backend.domain.notification.dto.DeviceTokenRequest;
import io.secureai.backend.domain.notification.service.DeviceTokenService;
import io.secureai.backend.global.response.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/fcm/device-tokens")
@RequiredArgsConstructor
public class DeviceTokenController {

    private final DeviceTokenService deviceTokenService;

    /**
     * FCM 디바이스 토큰 등록.
     * Android 앱 실행 시 획득한 FCM 토큰을 서버에 등록한다.
     */
    @PostMapping
    public ResponseEntity<ApiResponse<Void>> registerToken(
            @AuthenticationPrincipal UUID userId,
            @Valid @RequestBody DeviceTokenRequest request) {
        deviceTokenService.registerToken(userId, request.token());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(null));
    }

    /**
     * FCM 디바이스 토큰 삭제.
     * 로그아웃 또는 알림 비활성화 시 호출한다.
     */
    @DeleteMapping
    public ResponseEntity<ApiResponse<Void>> removeToken(
            @AuthenticationPrincipal UUID userId,
            @Valid @RequestBody DeviceTokenRequest request) {
        deviceTokenService.removeToken(userId, request.token());
        return ResponseEntity.ok(ApiResponse.success(null));
    }
}
