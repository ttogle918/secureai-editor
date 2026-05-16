package io.secureai.backend.domain.organization.service;

import io.secureai.backend.domain.organization.dto.*;
import io.secureai.backend.domain.organization.entity.OrgMember;
import io.secureai.backend.domain.organization.entity.Organization;
import io.secureai.backend.domain.organization.repository.OrgMemberRepository;
import io.secureai.backend.domain.organization.repository.OrganizationRepository;
import io.secureai.backend.domain.plan.Plan;
import io.secureai.backend.domain.plan.PlanRepository;
import io.secureai.backend.domain.user.entity.User;
import io.secureai.backend.domain.user.repository.UserRepository;
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
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OrganizationServiceTest {

    @Mock OrganizationRepository organizationRepository;
    @Mock OrgMemberRepository orgMemberRepository;
    @Mock UserRepository userRepository;
    @Mock PlanRepository planRepository;

    @InjectMocks OrganizationService organizationService;

    private UUID ownerId;
    private UUID memberId;
    private UUID orgId;
    private Organization org;
    private User owner;
    private Plan plan;
    private OrgMember ownerMember;

    @BeforeEach
    void setUp() {
        ownerId = UUID.randomUUID();
        memberId = UUID.randomUUID();
        orgId = UUID.randomUUID();

        plan = new Plan();
        ReflectionTestUtils.setField(plan, "name", "free");

        owner = User.builder()
                .email("owner@example.com")
                .username("owner-user")
                .displayName("Owner")
                .plan(plan)
                .emailVerified(true)
                .build();
        ReflectionTestUtils.setField(owner, "id", ownerId);

        org = Organization.builder()
                .name("Test Org")
                .slug("test-org")
                .description("설명")
                .owner(owner)
                .plan(plan)
                .build();
        ReflectionTestUtils.setField(org, "id", orgId);
        ReflectionTestUtils.setField(org, "createdAt", OffsetDateTime.now());

        ownerMember = OrgMember.builder()
                .orgId(orgId)
                .userId(ownerId)
                .role("owner")
                .acceptedAt(OffsetDateTime.now())
                .build();
    }

    @Test
    @DisplayName("내가 속한 조직 목록을 반환한다")
    void listMyOrgs_validUser_returnsOrgList() {
        when(organizationRepository.findAllByMemberUserId(ownerId)).thenReturn(List.of(org));
        when(orgMemberRepository.countByOrgIdAndAcceptedAtIsNotNull(orgId)).thenReturn(1L);

        List<OrgResponse> result = organizationService.listMyOrgs(ownerId);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).slug()).isEqualTo("test-org");
    }

    @Test
    @DisplayName("슬러그 중복 시 ORG_SLUG_DUPLICATE 예외가 발생한다")
    void createOrg_duplicateSlug_throwsBusinessException() {
        when(organizationRepository.findBySlugAndDeletedAtIsNull("test-org")).thenReturn(Optional.of(org));

        assertThatThrownBy(() -> organizationService.createOrg(ownerId, new CreateOrgRequest("Test Org", "test-org", null)))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.ORG_SLUG_DUPLICATE);
    }

    @Test
    @DisplayName("유효한 요청으로 조직을 생성하고 owner 멤버로 등록한다")
    void createOrg_validRequest_savesOrgAndOwnerMember() {
        when(organizationRepository.findBySlugAndDeletedAtIsNull("new-org")).thenReturn(Optional.empty());
        when(userRepository.findById(ownerId)).thenReturn(Optional.of(owner));
        when(planRepository.findByName("free")).thenReturn(Optional.of(plan));
        when(organizationRepository.save(any())).thenAnswer(inv -> {
            Organization saved = inv.getArgument(0);
            ReflectionTestUtils.setField(saved, "id", orgId);
            ReflectionTestUtils.setField(saved, "createdAt", OffsetDateTime.now());
            return saved;
        });
        when(orgMemberRepository.countByOrgIdAndAcceptedAtIsNotNull(any())).thenReturn(1L);

        OrgResponse response = organizationService.createOrg(ownerId, new CreateOrgRequest("New Org", "new-org", "설명"));

        assertThat(response.slug()).isEqualTo("new-org");
        assertThat(response.name()).isEqualTo("New Org");
        verify(orgMemberRepository).save(argThat(m -> "owner".equals(m.getRole())));
    }

    @Test
    @DisplayName("admin 권한이 없으면 updateOrg 시 ORG_ACCESS_DENIED 예외가 발생한다")
    void updateOrg_nonAdmin_throwsAccessDenied() {
        OrgMember regularMember = OrgMember.builder()
                .orgId(orgId).userId(memberId).role("member")
                .acceptedAt(OffsetDateTime.now()).build();
        when(organizationRepository.findBySlugAndDeletedAtIsNull("test-org")).thenReturn(Optional.of(org));
        when(orgMemberRepository.findByOrgIdAndUserId(orgId, memberId)).thenReturn(Optional.of(regularMember));

        assertThatThrownBy(() -> organizationService.updateOrg("test-org", memberId, new UpdateOrgRequest("new name", null)))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.ORG_ACCESS_DENIED);
    }

    @Test
    @DisplayName("owner가 아닌 사용자가 deleteOrg 시 ORG_ACCESS_DENIED 예외가 발생한다")
    void deleteOrg_nonOwner_throwsAccessDenied() {
        OrgMember adminMember = OrgMember.builder()
                .orgId(orgId).userId(memberId).role("admin")
                .acceptedAt(OffsetDateTime.now()).build();
        when(organizationRepository.findBySlugAndDeletedAtIsNull("test-org")).thenReturn(Optional.of(org));
        when(orgMemberRepository.findByOrgIdAndUserId(orgId, memberId)).thenReturn(Optional.of(adminMember));

        assertThatThrownBy(() -> organizationService.deleteOrg("test-org", memberId))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.ORG_ACCESS_DENIED);
    }

    @Test
    @DisplayName("owner가 deleteOrg 호출 시 soft-delete 처리된다")
    void deleteOrg_owner_marksDeleted() {
        when(organizationRepository.findBySlugAndDeletedAtIsNull("test-org")).thenReturn(Optional.of(org));
        when(orgMemberRepository.findByOrgIdAndUserId(orgId, ownerId)).thenReturn(Optional.of(ownerMember));

        organizationService.deleteOrg("test-org", ownerId);

        assertThat(org.getDeletedAt()).isNotNull();
        verify(organizationRepository).save(org);
    }

    @Test
    @DisplayName("이미 멤버인 사용자를 추가하면 ORG_ALREADY_MEMBER 예외가 발생한다")
    void addMember_alreadyMember_throwsAlreadyMember() {
        OrgMember existing = OrgMember.builder()
                .orgId(orgId).userId(memberId).role("member").acceptedAt(OffsetDateTime.now()).build();
        when(organizationRepository.findBySlugAndDeletedAtIsNull("test-org")).thenReturn(Optional.of(org));
        when(orgMemberRepository.findByOrgIdAndUserId(orgId, ownerId)).thenReturn(Optional.of(ownerMember));
        when(userRepository.findById(memberId)).thenReturn(Optional.of(owner));
        when(orgMemberRepository.findByOrgIdAndUserId(orgId, memberId)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> organizationService.addMember("test-org", memberId, "member", ownerId))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.ORG_ALREADY_MEMBER);
    }

    @Test
    @DisplayName("owner를 제거하려 하면 ORG_ACCESS_DENIED 예외가 발생한다")
    void removeMember_ownerTarget_throwsAccessDenied() {
        when(organizationRepository.findBySlugAndDeletedAtIsNull("test-org")).thenReturn(Optional.of(org));
        when(orgMemberRepository.findByOrgIdAndUserId(orgId, ownerId)).thenReturn(Optional.of(ownerMember));

        assertThatThrownBy(() -> organizationService.removeMember("test-org", ownerId, ownerId))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.ORG_ACCESS_DENIED);
    }

    @Test
    @DisplayName("owner 역할을 변경하려 하면 ORG_ACCESS_DENIED 예외가 발생한다")
    void changeMemberRole_ownerTarget_throwsAccessDenied() {
        OrgMember targetOwner = OrgMember.builder()
                .orgId(orgId).userId(memberId).role("owner")
                .acceptedAt(OffsetDateTime.now()).build();
        when(organizationRepository.findBySlugAndDeletedAtIsNull("test-org")).thenReturn(Optional.of(org));
        when(orgMemberRepository.findByOrgIdAndUserId(orgId, ownerId)).thenReturn(Optional.of(ownerMember));
        when(orgMemberRepository.findByOrgIdAndUserId(orgId, memberId)).thenReturn(Optional.of(targetOwner));

        assertThatThrownBy(() -> organizationService.changeMemberRole("test-org", memberId, "admin", ownerId))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.ORG_ACCESS_DENIED);
    }
}
