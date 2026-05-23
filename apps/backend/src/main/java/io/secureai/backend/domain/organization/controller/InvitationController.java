package io.secureai.backend.domain.organization.controller;

import io.secureai.backend.domain.organization.entity.TeamInvitation;
import io.secureai.backend.domain.organization.service.InvitationService;
import io.secureai.backend.global.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/invitations")
@RequiredArgsConstructor
public class InvitationController {

    private final InvitationService invitationService;

    @GetMapping("/{token}")
    public ResponseEntity<ApiResponse<InvitationInfoResponse>> getInvitationInfo(
            @PathVariable String token) {
        TeamInvitation invitation = invitationService.getInvitationInfo(token);
        InvitationInfoResponse response = new InvitationInfoResponse(
                invitation.getOrgId(),
                invitation.getProjectId(),
                invitation.getEmail(),
                invitation.getRole(),
                invitation.getExpiresAt().toString()
        );
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping("/{token}/accept")
    public ResponseEntity<Void> acceptInvitation(
            @PathVariable String token,
            @AuthenticationPrincipal UUID userId) {
        invitationService.acceptInvitation(token, userId);
        return ResponseEntity.noContent().build();
    }

    record InvitationInfoResponse(
            UUID orgId,
            UUID projectId,
            String email,
            String role,
            String expiresAt
    ) {}
}
