package io.secureai.backend.domain.user.controller;

import io.secureai.backend.domain.user.dto.*;
import io.secureai.backend.domain.user.service.UserService;
import io.secureai.backend.global.aop.AuditLog;
import io.secureai.backend.global.response.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<UserMeResponse>> getMe(@AuthenticationPrincipal UUID userId) {
        return ResponseEntity.ok(ApiResponse.success(userService.getMe(userId)));
    }

    @PatchMapping("/me")
    public ResponseEntity<ApiResponse<UserMeResponse>> updateMe(
            @AuthenticationPrincipal UUID userId,
            @Valid @RequestBody UpdateUserRequest request) {
        return ResponseEntity.ok(ApiResponse.success(userService.updateMe(userId, request)));
    }

    @PutMapping("/me/password")
    @AuditLog(action = "CHANGE_PASSWORD", resource = "user")
    public ResponseEntity<Void> changePassword(
            @AuthenticationPrincipal UUID userId,
            @Valid @RequestBody ChangePasswordRequest request) {
        userService.changePassword(userId, request.getCurrentPassword(), request.getNewPassword());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/me")
    @AuditLog(action = "DELETE_ACCOUNT", resource = "user")
    public ResponseEntity<Void> deleteMe(
            @AuthenticationPrincipal UUID userId,
            @Valid @RequestBody DeleteMeRequest request) {
        userService.deleteMe(userId, request.getConfirmPassword());
        return ResponseEntity.noContent().build();
    }

    // ── 크레딧 & 설정 ──────────────────────────────────────────────────────

    @GetMapping("/me/credits")
    public ResponseEntity<ApiResponse<CreditSummaryResponse>> getCredits(
            @AuthenticationPrincipal UUID userId) {
        return ResponseEntity.ok(ApiResponse.success(userService.getCredits(userId)));
    }

    @PutMapping("/me/settings")
    public ResponseEntity<ApiResponse<CreditSummaryResponse>> updateSettings(
            @AuthenticationPrincipal UUID userId,
            @Valid @RequestBody UpdateSettingsRequest request) {
        return ResponseEntity.ok(ApiResponse.success(userService.updateSettings(userId, request)));
    }

    @PutMapping("/me/api-key")
    @AuditLog(action = "SAVE_API_KEY", resource = "user")
    public ResponseEntity<ApiResponse<Map<String, Boolean>>> saveApiKey(
            @AuthenticationPrincipal UUID userId,
            @Valid @RequestBody SaveApiKeyRequest request) {
        userService.saveApiKey(userId, request.apiKey());
        return ResponseEntity.ok(ApiResponse.success(Map.of("hasByok", true)));
    }

    @DeleteMapping("/me/api-key")
    @AuditLog(action = "REMOVE_API_KEY", resource = "user")
    public ResponseEntity<ApiResponse<Map<String, Boolean>>> removeApiKey(
            @AuthenticationPrincipal UUID userId) {
        userService.removeApiKey(userId);
        return ResponseEntity.ok(ApiResponse.success(Map.of("hasByok", false)));
    }
}
