package io.secureai.backend.domain.user.controller;

import io.secureai.backend.domain.user.dto.ChangePasswordRequest;
import io.secureai.backend.domain.user.dto.DeleteMeRequest;
import io.secureai.backend.domain.user.dto.UpdateUserRequest;
import io.secureai.backend.domain.user.dto.UserMeResponse;
import io.secureai.backend.domain.user.service.UserService;
import io.secureai.backend.global.aop.AuditLog;
import io.secureai.backend.global.response.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

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
}
