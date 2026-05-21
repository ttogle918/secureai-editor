package io.secureai.backend.domain.organization.service;

import io.secureai.backend.domain.auth.service.EmailService;
import io.secureai.backend.domain.organization.dto.InviteMemberRequest;
import io.secureai.backend.domain.organization.entity.OrgMember;
import io.secureai.backend.domain.organization.entity.Organization;
import io.secureai.backend.domain.organization.entity.TeamInvitation;
import io.secureai.backend.domain.organization.repository.OrgMemberRepository;
import io.secureai.backend.domain.organization.repository.OrganizationRepository;
import io.secureai.backend.domain.organization.repository.TeamInvitationRepository;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@Transactional
@RequiredArgsConstructor
public class InvitationService {

    private static final int TOKEN_BYTE_LENGTH = 48;
    private static final int EXPIRES_HOURS = 72;
    private static final List<String> ADMIN_ROLES = List.of("owner", "admin");

    private final TeamInvitationRepository teamInvitationRepository;
    private final OrgMemberRepository orgMemberRepository;
    private final OrganizationRepository organizationRepository;
    private final EmailService emailService;

    private final SecureRandom secureRandom = new SecureRandom();

    public void inviteByEmail(String slug, InviteMemberRequest request, UUID inviterId) {
        Organization org = loadOrgBySlug(slug);
        requireAdminOrAbove(org.getId(), inviterId);

        String token = generateToken();
        TeamInvitation invitation = TeamInvitation.builder()
                .orgId(org.getId())
                .email(request.email())
                .role(request.role())
                .token(token)
                .invitedBy(inviterId)
                .expiresAt(OffsetDateTime.now().plusHours(EXPIRES_HOURS))
                .build();
        teamInvitationRepository.save(invitation);

        emailService.sendOrgInvitation(request.email(), token, org.getName());
        log.info("org invitation created: orgId={} email={}", org.getId(), request.email());
    }

    public void acceptInvitation(String token, UUID userId) {
        TeamInvitation invitation = teamInvitationRepository.findByTokenAndAcceptedAtIsNull(token)
                .orElseThrow(() -> new BusinessException(ErrorCode.INVITATION_NOT_FOUND));

        if (invitation.isExpired()) {
            throw new BusinessException(ErrorCode.INVITATION_EXPIRED);
        }

        if (invitation.getOrgId() != null) {
            orgMemberRepository.findByOrgIdAndUserId(invitation.getOrgId(), userId).ifPresent(m -> {
                throw new BusinessException(ErrorCode.ORG_ALREADY_MEMBER);
            });
            orgMemberRepository.save(OrgMember.builder()
                    .orgId(invitation.getOrgId())
                    .userId(userId)
                    .role(invitation.getRole())
                    .invitedBy(invitation.getInvitedBy())
                    .acceptedAt(OffsetDateTime.now())
                    .build());
        }

        invitation.accept();
        teamInvitationRepository.save(invitation);
    }

    @Transactional(readOnly = true)
    public TeamInvitation getInvitationInfo(String token) {
        TeamInvitation invitation = teamInvitationRepository.findByTokenAndAcceptedAtIsNull(token)
                .orElseThrow(() -> new BusinessException(ErrorCode.INVITATION_NOT_FOUND));
        if (invitation.isExpired()) {
            throw new BusinessException(ErrorCode.INVITATION_EXPIRED);
        }
        return invitation;
    }

    private Organization loadOrgBySlug(String slug) {
        return organizationRepository.findBySlugAndDeletedAtIsNull(slug)
                .orElseThrow(() -> new BusinessException(ErrorCode.ORG_NOT_FOUND));
    }

    private void requireAdminOrAbove(UUID orgId, UUID userId) {
        OrgMember member = orgMemberRepository.findByOrgIdAndUserId(orgId, userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.ORG_ACCESS_DENIED));
        if (!member.isAccepted() || !ADMIN_ROLES.contains(member.getRole())) {
            throw new BusinessException(ErrorCode.ORG_ACCESS_DENIED, "admin 이상의 권한이 필요합니다.");
        }
    }

    private String generateToken() {
        byte[] bytes = new byte[TOKEN_BYTE_LENGTH];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes).substring(0, 64);
    }
}
