package io.secureai.backend.domain.admin.controller;

import io.secureai.backend.domain.admin.dto.AdminCreditRequest;
import io.secureai.backend.domain.admin.dto.AdminPlanChangeRequest;
import io.secureai.backend.domain.admin.dto.AdminUserResponse;
import io.secureai.backend.domain.admin.service.AdminService;
import io.secureai.backend.global.response.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AdminService adminService;

    @GetMapping("/users")
    @PreAuthorize("@adminGuard.check(authentication)")
    public ResponseEntity<ApiResponse<Page<AdminUserResponse>>> listUsers(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Short planId,
            @RequestParam(required = false) Boolean isActive,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable,
            @AuthenticationPrincipal UUID adminId) {

        Page<AdminUserResponse> page = adminService.listUsers(search, planId, isActive, pageable);
        return ResponseEntity.ok(ApiResponse.success(page));
    }

    @GetMapping("/users/{userId}")
    @PreAuthorize("@adminGuard.check(authentication)")
    public ResponseEntity<ApiResponse<AdminUserResponse>> getUser(
            @PathVariable UUID userId,
            @AuthenticationPrincipal UUID adminId) {

        AdminUserResponse user = adminService.getUser(userId);
        return ResponseEntity.ok(ApiResponse.success(user));
    }

    @PatchMapping("/users/{userId}/plan")
    @PreAuthorize("@adminGuard.check(authentication)")
    public ResponseEntity<ApiResponse<AdminUserResponse>> changeUserPlan(
            @PathVariable UUID userId,
            @Valid @RequestBody AdminPlanChangeRequest request,
            @AuthenticationPrincipal UUID adminId) {

        adminService.changeUserPlan(userId, request.planId(), request.reason(), adminId);
        AdminUserResponse updated = adminService.getUser(userId);
        return ResponseEntity.ok(ApiResponse.success(updated));
    }

    @PatchMapping("/users/{userId}/status")
    @PreAuthorize("@adminGuard.check(authentication)")
    public ResponseEntity<ApiResponse<AdminUserResponse>> toggleUserActive(
            @PathVariable UUID userId,
            @RequestParam boolean isActive,
            @AuthenticationPrincipal UUID adminId) {

        adminService.toggleUserActive(userId, isActive, adminId);
        AdminUserResponse updated = adminService.getUser(userId);
        return ResponseEntity.ok(ApiResponse.success(updated));
    }

    @PostMapping("/users/{userId}/credits")
    @PreAuthorize("@adminGuard.check(authentication)")
    public ResponseEntity<ApiResponse<Map<String, Integer>>> adjustCredits(
            @PathVariable UUID userId,
            @Valid @RequestBody AdminCreditRequest request,
            @AuthenticationPrincipal UUID adminId) {

        int balanceAfter = adminService.adjustCredits(userId, request.delta(), request.reason(), adminId);
        return ResponseEntity.ok(ApiResponse.success(Map.of("balanceAfter", balanceAfter)));
    }
}
