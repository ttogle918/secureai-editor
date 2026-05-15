package io.secureai.backend.domain.organization.controller;

import io.secureai.backend.domain.organization.entity.TeamInvitation;
import io.secureai.backend.domain.organization.repository.TeamInvitationRepository;
import io.secureai.backend.domain.organization.service.OrganizationService;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
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

    private final OrganizationService organizationService;
    private final TeamInvitationRepository teamInvitationRepository;

    /**
     * 초대 토큰 유효성 확인 (비인증 허용).
     * 이메일 링크 클릭 시 프론트엔드가 호출하여 org/project 이름을 표시한다.
     */
    @GetMapping("/{token}")
    public ResponseEntity<ApiResponse<InvitationInfoResponse>> getInvitationInfo(
            @PathVariable String token) {
        TeamInvitation invitation = teamInvitationRepository.findByTokenAndAcceptedAtIsNull(token)
                .orElseThrow(() -> new BusinessException(ErrorCode.INVITATION_NOT_FOUND));

        if (invitation.isExpired()) {
            throw new BusinessException(ErrorCode.INVITATION_EXPIRED);
        }

        InvitationInfoResponse response = new InvitationInfoResponse(
                invitation.getOrgId(),
                invitation.getProjectId(),
                invitation.getEmail(),
                invitation.getRole(),
                invitation.getExpiresAt().toString()
        );
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    /**
     * 초대 수락 (JWT 인증 필요).
     * 인증된 사용자가 초대를 수락하면 org_members 또는 project_members에 추가된다.
     */
    @PostMapping("/{token}/accept")
    public ResponseEntity<Void> acceptInvitation(
            @PathVariable String token,
            @AuthenticationPrincipal UUID userId) {
        organizationService.acceptInvitation(token, userId);
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
