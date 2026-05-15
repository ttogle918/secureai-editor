package io.secureai.backend.domain.organization.controller;

import io.secureai.backend.domain.organization.dto.*;
import io.secureai.backend.domain.organization.service.OrganizationService;
import io.secureai.backend.global.response.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/organizations")
@RequiredArgsConstructor
public class OrganizationController {

    private final OrganizationService organizationService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<OrgResponse>>> listMyOrgs(
            @AuthenticationPrincipal UUID userId) {
        return ResponseEntity.ok(ApiResponse.success(organizationService.listMyOrgs(userId)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<OrgResponse>> createOrg(
            @AuthenticationPrincipal UUID userId,
            @Valid @RequestBody CreateOrgRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(organizationService.createOrg(userId, request)));
    }

    @GetMapping("/{slug}")
    public ResponseEntity<ApiResponse<OrgResponse>> getOrg(
            @PathVariable String slug) {
        return ResponseEntity.ok(ApiResponse.success(organizationService.getOrg(slug)));
    }

    @PatchMapping("/{slug}")
    @PreAuthorize("@orgGuard.isAdminOrAbove(authentication, @organizationService.resolveOrgId(#slug))")
    public ResponseEntity<ApiResponse<OrgResponse>> updateOrg(
            @PathVariable String slug,
            @AuthenticationPrincipal UUID userId,
            @RequestBody UpdateOrgRequest request) {
        return ResponseEntity.ok(ApiResponse.success(organizationService.updateOrg(slug, userId, request)));
    }

    @DeleteMapping("/{slug}")
    public ResponseEntity<Void> deleteOrg(
            @PathVariable String slug,
            @AuthenticationPrincipal UUID userId) {
        organizationService.deleteOrg(slug, userId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{slug}/members")
    public ResponseEntity<ApiResponse<List<OrgMemberResponse>>> listMembers(
            @PathVariable String slug,
            @AuthenticationPrincipal UUID userId) {
        return ResponseEntity.ok(ApiResponse.success(organizationService.listMembers(slug, userId)));
    }

    @PostMapping("/{slug}/members")
    public ResponseEntity<ApiResponse<OrgMemberResponse>> addMember(
            @PathVariable String slug,
            @AuthenticationPrincipal UUID userId,
            @RequestBody AddMemberRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(
                        organizationService.addMember(slug, request.userId(), request.role(), userId)));
    }

    @PatchMapping("/{slug}/members/{targetUserId}/role")
    public ResponseEntity<ApiResponse<OrgMemberResponse>> changeMemberRole(
            @PathVariable String slug,
            @PathVariable UUID targetUserId,
            @AuthenticationPrincipal UUID userId,
            @RequestBody RoleChangeRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                organizationService.changeMemberRole(slug, targetUserId, request.role(), userId)));
    }

    @DeleteMapping("/{slug}/members/{targetUserId}")
    public ResponseEntity<Void> removeMember(
            @PathVariable String slug,
            @PathVariable UUID targetUserId,
            @AuthenticationPrincipal UUID userId) {
        organizationService.removeMember(slug, targetUserId, userId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{slug}/invite")
    public ResponseEntity<Void> inviteByEmail(
            @PathVariable String slug,
            @AuthenticationPrincipal UUID userId,
            @Valid @RequestBody InviteMemberRequest request) {
        organizationService.inviteByEmail(slug, request, userId);
        return ResponseEntity.status(HttpStatus.ACCEPTED).build();
    }

    @GetMapping("/{slug}/usage")
    @PreAuthorize("@orgGuard.isAdminOrAbove(authentication, @organizationService.resolveOrgId(#slug))")
    public ResponseEntity<ApiResponse<OrgUsageResponse>> getOrgUsage(
            @PathVariable String slug,
            @AuthenticationPrincipal UUID userId) {
        return ResponseEntity.ok(ApiResponse.success(organizationService.getOrgUsage(slug, userId)));
    }

    /** 컨트롤러 내부 request 전용 record — 별도 파일 불필요 */
    record AddMemberRequest(UUID userId, String role) {}
    record RoleChangeRequest(String role) {}
}
