package io.secureai.backend.domain.organization.service;

import io.secureai.backend.domain.auth.service.EmailService;
import io.secureai.backend.domain.organization.dto.InviteMemberRequest;
import io.secureai.backend.domain.organization.entity.OrgMember;
import io.secureai.backend.domain.organization.entity.Organization;
import io.secureai.backend.domain.organization.entity.TeamInvitation;
import io.secureai.backend.domain.organization.repository.OrgMemberRepository;
import io.secureai.backend.domain.organization.repository.OrganizationRepository;
import io.secureai.backend.domain.organization.repository.TeamInvitationRepository;
import io.secureai.backend.domain.plan.Plan;
import io.secureai.backend.domain.user.entity.User;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class InvitationServiceTest {

    @Mock TeamInvitationRepository teamInvitationRepository;
    @Mock OrgMemberRepository orgMemberRepository;
    @Mock OrganizationRepository organizationRepository;
    @Mock EmailService emailService;

    @InjectMocks InvitationService invitationService;

    private UUID inviterId;
    private UUID targetUserId;
    private UUID orgId;
    private Organization org;
    private OrgMember adminMember;

    @BeforeEach
    void setUp() {
        inviterId = UUID.randomUUID();
        targetUserId = UUID.randomUUID();
        orgId = UUID.randomUUID();

        Plan plan = new Plan();
        ReflectionTestUtils.setField(plan, "name", "free");

        User owner = User.builder()
                .email("owner@example.com")
                .username("owner-user")
                .displayName("Owner")
                .plan(plan)
                .emailVerified(true)
                .build();
        ReflectionTestUtils.setField(owner, "id", inviterId);

        org = Organization.builder()
                .name("Test Org")
                .slug("test-org")
                .description("설명")
                .owner(owner)
                .plan(plan)
                .build();
        ReflectionTestUtils.setField(org, "id", orgId);
        ReflectionTestUtils.setField(org, "createdAt", OffsetDateTime.now());

        adminMember = OrgMember.builder()
                .orgId(orgId)
                .userId(inviterId)
                .role("admin")
                .acceptedAt(OffsetDateTime.now())
                .build();
    }

    @Test
    @DisplayName("admin 권한 없이 초대하면 ORG_ACCESS_DENIED 예외가 발생한다")
    void inviteByEmail_nonAdmin_throwsAccessDenied() {
        OrgMember member = OrgMember.builder()
                .orgId(orgId).userId(inviterId).role("member")
                .acceptedAt(OffsetDateTime.now()).build();
        when(organizationRepository.findBySlugAndDeletedAtIsNull("test-org")).thenReturn(Optional.of(org));
        when(orgMemberRepository.findByOrgIdAndUserId(orgId, inviterId)).thenReturn(Optional.of(member));

        assertThatThrownBy(() -> invitationService.inviteByEmail(
                "test-org", new InviteMemberRequest("new@example.com", "member"), inviterId))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.ORG_ACCESS_DENIED);

        verifyNoInteractions(teamInvitationRepository, emailService);
    }

    @Test
    @DisplayName("admin이 초대하면 TeamInvitation이 저장되고 이메일이 발송된다")
    void inviteByEmail_admin_savesInvitationAndSendsEmail() {
        when(organizationRepository.findBySlugAndDeletedAtIsNull("test-org")).thenReturn(Optional.of(org));
        when(orgMemberRepository.findByOrgIdAndUserId(orgId, inviterId)).thenReturn(Optional.of(adminMember));

        invitationService.inviteByEmail(
                "test-org", new InviteMemberRequest("new@example.com", "member"), inviterId);

        verify(teamInvitationRepository).save(argThat(inv ->
                "new@example.com".equals(inv.getEmail())
                && orgId.equals(inv.getOrgId())
                && inv.getToken() != null && inv.getToken().length() == 64
        ));
        verify(emailService).sendOrgInvitation(eq("new@example.com"), anyString(), eq("Test Org"));
    }

    @Test
    @DisplayName("존재하지 않는 토큰으로 수락하면 INVITATION_NOT_FOUND 예외가 발생한다")
    void acceptInvitation_tokenNotFound_throwsNotFound() {
        when(teamInvitationRepository.findByTokenAndAcceptedAtIsNull("bad-token")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> invitationService.acceptInvitation("bad-token", targetUserId))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.INVITATION_NOT_FOUND);
    }

    @Test
    @DisplayName("만료된 토큰으로 수락하면 INVITATION_EXPIRED 예외가 발생한다")
    void acceptInvitation_expiredToken_throwsExpired() {
        TeamInvitation expired = TeamInvitation.builder()
                .orgId(orgId)
                .email("user@example.com")
                .role("member")
                .token("some-token")
                .invitedBy(inviterId)
                .expiresAt(OffsetDateTime.now().minusHours(1))
                .build();
        when(teamInvitationRepository.findByTokenAndAcceptedAtIsNull("some-token")).thenReturn(Optional.of(expired));

        assertThatThrownBy(() -> invitationService.acceptInvitation("some-token", targetUserId))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.INVITATION_EXPIRED);
    }

    @Test
    @DisplayName("유효한 org 초대를 수락하면 OrgMember가 저장되고 invitation이 accept 처리된다")
    void acceptInvitation_validOrgInvitation_savesMemberAndAcceptsInvitation() {
        TeamInvitation invitation = TeamInvitation.builder()
                .orgId(orgId)
                .email("user@example.com")
                .role("member")
                .token("valid-token")
                .invitedBy(inviterId)
                .expiresAt(OffsetDateTime.now().plusHours(72))
                .build();
        when(teamInvitationRepository.findByTokenAndAcceptedAtIsNull("valid-token")).thenReturn(Optional.of(invitation));
        when(orgMemberRepository.findByOrgIdAndUserId(orgId, targetUserId)).thenReturn(Optional.empty());

        invitationService.acceptInvitation("valid-token", targetUserId);

        verify(orgMemberRepository).save(argThat(m ->
                orgId.equals(m.getOrgId())
                && targetUserId.equals(m.getUserId())
                && "member".equals(m.getRole())
        ));
        verify(teamInvitationRepository).save(argThat(inv -> inv.getAcceptedAt() != null));
    }

    @Test
    @DisplayName("이미 멤버인 사용자가 초대를 수락하면 ORG_ALREADY_MEMBER 예외가 발생한다")
    void acceptInvitation_alreadyMember_throwsAlreadyMember() {
        TeamInvitation invitation = TeamInvitation.builder()
                .orgId(orgId)
                .email("user@example.com")
                .role("member")
                .token("valid-token")
                .invitedBy(inviterId)
                .expiresAt(OffsetDateTime.now().plusHours(72))
                .build();
        OrgMember existing = OrgMember.builder()
                .orgId(orgId).userId(targetUserId).role("member").acceptedAt(OffsetDateTime.now()).build();
        when(teamInvitationRepository.findByTokenAndAcceptedAtIsNull("valid-token")).thenReturn(Optional.of(invitation));
        when(orgMemberRepository.findByOrgIdAndUserId(orgId, targetUserId)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> invitationService.acceptInvitation("valid-token", targetUserId))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.ORG_ALREADY_MEMBER);
    }

    @Test
    @DisplayName("유효한 토큰으로 초대 정보를 조회하면 invitation이 반환된다")
    void getInvitationInfo_validToken_returnsInvitation() {
        TeamInvitation invitation = TeamInvitation.builder()
                .orgId(orgId)
                .email("user@example.com")
                .role("member")
                .token("valid-token")
                .invitedBy(inviterId)
                .expiresAt(OffsetDateTime.now().plusHours(72))
                .build();
        when(teamInvitationRepository.findByTokenAndAcceptedAtIsNull("valid-token")).thenReturn(Optional.of(invitation));

        TeamInvitation result = invitationService.getInvitationInfo("valid-token");

        assertThat(result.getEmail()).isEqualTo("user@example.com");
        assertThat(result.getRole()).isEqualTo("member");
    }

    @Test
    @DisplayName("만료된 토큰으로 초대 정보를 조회하면 INVITATION_EXPIRED 예외가 발생한다")
    void getInvitationInfo_expiredToken_throwsExpired() {
        TeamInvitation expired = TeamInvitation.builder()
                .orgId(orgId)
                .email("user@example.com")
                .role("member")
                .token("expired-token")
                .invitedBy(inviterId)
                .expiresAt(OffsetDateTime.now().minusMinutes(1))
                .build();
        when(teamInvitationRepository.findByTokenAndAcceptedAtIsNull("expired-token")).thenReturn(Optional.of(expired));

        assertThatThrownBy(() -> invitationService.getInvitationInfo("expired-token"))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.INVITATION_EXPIRED);
    }
}
