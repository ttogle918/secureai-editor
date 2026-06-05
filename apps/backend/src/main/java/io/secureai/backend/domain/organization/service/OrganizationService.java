package io.secureai.backend.domain.organization.service;

import io.secureai.backend.domain.organization.dto.*;
import io.secureai.backend.domain.organization.entity.OrgMember;
import io.secureai.backend.domain.organization.entity.Organization;
import io.secureai.backend.domain.organization.repository.OrgMemberRepository;
import io.secureai.backend.domain.organization.repository.OrganizationRepository;
import io.secureai.backend.domain.plan.Plan;
import io.secureai.backend.domain.plan.PlanService;
import io.secureai.backend.domain.user.entity.User;
import io.secureai.backend.domain.user.service.UserService;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@Transactional
@RequiredArgsConstructor
public class OrganizationService {

    private static final String DEFAULT_PLAN_NAME = "free";
    private static final List<String> ADMIN_ROLES = List.of("owner", "admin");

    private final OrganizationRepository organizationRepository;
    private final OrgMemberRepository orgMemberRepository;
    private final UserService userService;
    private final PlanService planService;
    private final OrgAnalyticsService orgAnalyticsService;

    @Transactional(readOnly = true)
    public List<OrgResponse> listMyOrgs(UUID userId) {
        return organizationRepository.findAllByMemberUserId(userId)
                .stream()
                .map(org -> toOrgResponse(org, userId))
                .toList();
    }

    @Transactional(readOnly = true)
    public OrgResponse getOrg(String slug, UUID userId) {
        Organization org = loadOrgBySlug(slug);
        return toOrgResponse(org, userId);
    }

    public OrgResponse createOrg(UUID ownerId, CreateOrgRequest request) {
        if (organizationRepository.findBySlugAndDeletedAtIsNull(request.slug()).isPresent()) {
            throw new BusinessException(ErrorCode.ORG_SLUG_DUPLICATE);
        }

        User owner = userService.findOrThrow(ownerId);
        Plan plan = planService.findByName(DEFAULT_PLAN_NAME);

        Organization org = Organization.builder()
                .name(request.name())
                .slug(request.slug())
                .description(request.description())
                .owner(owner)
                .plan(plan)
                .build();
        organizationRepository.save(org);

        OrgMember ownerMember = OrgMember.builder()
                .orgId(org.getId())
                .userId(ownerId)
                .role("owner")
                .invitedBy(ownerId)
                .acceptedAt(OffsetDateTime.now())
                .build();
        orgMemberRepository.save(ownerMember);

        return toOrgResponse(org, ownerId);
    }

    public OrgResponse updateOrg(String slug, UUID userId, UpdateOrgRequest request) {
        Organization org = loadOrgBySlug(slug);
        requireAdminOrAbove(org.getId(), userId);

        if (request.name() != null) {
            org.setName(request.name());
        }
        if (request.description() != null) {
            org.setDescription(request.description());
        }
        organizationRepository.save(org);
        return toOrgResponse(org, userId);
    }

    public void deleteOrg(String slug, UUID userId) {
        Organization org = loadOrgBySlug(slug);
        requireOwner(org.getId(), userId);
        org.markDeleted();
        organizationRepository.save(org);
    }

    @Transactional(readOnly = true)
    public List<OrgMemberResponse> listMembers(String slug, UUID requesterId) {
        Organization org = loadOrgBySlug(slug);
        requireMember(org.getId(), requesterId);

        List<OrgMember> members = orgMemberRepository.findByOrgId(org.getId());
        List<UUID> userIds = members.stream().map(OrgMember::getUserId).toList();
        List<User> users = userService.findAllByIds(userIds);

        return members.stream()
                .map(member -> {
                    User user = users.stream()
                            .filter(u -> u.getId().equals(member.getUserId()))
                            .findFirst()
                            .orElse(null);
                    return toOrgMemberResponse(member, user);
                })
                .toList();
    }

    public OrgMemberResponse addMember(String slug, UUID targetUserId, String role, UUID requesterId) {
        Organization org = loadOrgBySlug(slug);
        requireAdminOrAbove(org.getId(), requesterId);

        userService.findOrThrow(targetUserId);

        orgMemberRepository.findByOrgIdAndUserId(org.getId(), targetUserId).ifPresent(m -> {
            throw new BusinessException(ErrorCode.ORG_ALREADY_MEMBER);
        });

        OrgMember member = OrgMember.builder()
                .orgId(org.getId())
                .userId(targetUserId)
                .role(role)
                .invitedBy(requesterId)
                .acceptedAt(OffsetDateTime.now())
                .build();
        orgMemberRepository.save(member);

        User targetUser = userService.findOrThrow(targetUserId);
        return toOrgMemberResponse(member, targetUser);
    }

    public OrgMemberResponse changeMemberRole(String slug, UUID targetUserId, String role, UUID requesterId) {
        Organization org = loadOrgBySlug(slug);
        requireAdminOrAbove(org.getId(), requesterId);

        OrgMember member = orgMemberRepository.findByOrgIdAndUserId(org.getId(), targetUserId)
                .orElseThrow(() -> new BusinessException(ErrorCode.ORG_NOT_FOUND, "해당 멤버를 찾을 수 없습니다."));

        if ("owner".equals(member.getRole())) {
            throw new BusinessException(ErrorCode.ORG_ACCESS_DENIED, "owner의 역할은 변경할 수 없습니다.");
        }

        member.setRole(role);
        orgMemberRepository.save(member);

        User targetUser = userService.findOrThrow(targetUserId);
        return toOrgMemberResponse(member, targetUser);
    }

    public void removeMember(String slug, UUID targetUserId, UUID requesterId) {
        Organization org = loadOrgBySlug(slug);
        requireAdminOrAbove(org.getId(), requesterId);

        OrgMember member = orgMemberRepository.findByOrgIdAndUserId(org.getId(), targetUserId)
                .orElseThrow(() -> new BusinessException(ErrorCode.ORG_NOT_FOUND, "해당 멤버를 찾을 수 없습니다."));

        if ("owner".equals(member.getRole())) {
            throw new BusinessException(ErrorCode.ORG_ACCESS_DENIED, "owner는 조직에서 제거할 수 없습니다.");
        }

        orgMemberRepository.delete(member);
    }

    @Transactional(readOnly = true)
    public OrgUsageResponse getOrgUsage(String slug, UUID requesterId) {
        Organization org = loadOrgBySlug(slug);
        requireAdminOrAbove(org.getId(), requesterId);

        long memberCount = orgMemberRepository.countByOrgIdAndAcceptedAtIsNotNull(org.getId());

        // org 소속 멤버 userId로 해당 멤버들이 생성한 세션/취약점 집계
        // Project에 orgId 컬럼이 없으므로 org 멤버 소유 프로젝트 기준으로 집계
        long totalScans = orgAnalyticsService.countSessionsByOrgMembers(org.getId());
        long totalVulns = orgAnalyticsService.countVulnsByOrgMembers(org.getId());
        long totalCreditsUsed = 0L; // TODO: credit_transactions 테이블 연동 후 집계 가능
        long projectCount = orgAnalyticsService.countProjectsByOrgMembers(org.getId());

        return new OrgUsageResponse(
                org.getId(),
                org.getName(),
                totalScans,
                totalVulns,
                totalCreditsUsed,
                (int) memberCount,
                (int) projectCount
        );
    }

    // ── 공개 헬퍼 메서드 (SpEL @PreAuthorize 에서 사용) ────────────────────

    /**
     * 슬러그로 조직 UUID를 반환한다.
     * {@code @PreAuthorize("@orgGuard.isAdminOrAbove(authentication, @organizationService.resolveOrgId(#slug))")}
     * 에서 SpEL 표현식으로 사용된다.
     */
    @Transactional(readOnly = true)
    public UUID resolveOrgId(String slug) {
        return loadOrgBySlug(slug).getId();
    }

    // ── 내부 헬퍼 메서드 ────────────────────────────────────────────────────

    private Organization loadOrgBySlug(String slug) {
        return organizationRepository.findBySlugAndDeletedAtIsNull(slug)
                .orElseThrow(() -> new BusinessException(ErrorCode.ORG_NOT_FOUND));
    }

    private void requireMember(UUID orgId, UUID userId) {
        orgMemberRepository.findByOrgIdAndUserId(orgId, userId)
                .filter(OrgMember::isAccepted)
                .orElseThrow(() -> new BusinessException(ErrorCode.ORG_ACCESS_DENIED));
    }

    private void requireAdminOrAbove(UUID orgId, UUID userId) {
        OrgMember member = orgMemberRepository.findByOrgIdAndUserId(orgId, userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.ORG_ACCESS_DENIED));

        if (!member.isAccepted() || !ADMIN_ROLES.contains(member.getRole())) {
            throw new BusinessException(ErrorCode.ORG_ACCESS_DENIED, "admin 이상의 권한이 필요합니다.");
        }
    }

    private void requireOwner(UUID orgId, UUID userId) {
        OrgMember member = orgMemberRepository.findByOrgIdAndUserId(orgId, userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.ORG_ACCESS_DENIED));

        if (!"owner".equals(member.getRole())) {
            throw new BusinessException(ErrorCode.ORG_ACCESS_DENIED, "owner 권한이 필요합니다.");
        }
    }

    private OrgResponse toOrgResponse(Organization org, UUID userId) {
        long memberCount = orgMemberRepository.countByOrgIdAndAcceptedAtIsNotNull(org.getId());
        String role = null;
        if (userId != null) {
            role = orgMemberRepository.findByOrgIdAndUserId(org.getId(), userId)
                    .filter(OrgMember::isAccepted)
                    .map(OrgMember::getRole)
                    .orElse(null);
        }
        return new OrgResponse(
                org.getId(),
                org.getName(),
                org.getSlug(),
                org.getDescription(),
                org.getOwner().getUsername(),
                memberCount,
                org.getPlan().getName(),
                org.getAvatarUrl(),
                org.getCreatedAt(),
                role
        );
    }

    private OrgMemberResponse toOrgMemberResponse(OrgMember member, User user) {
        String username = user != null ? user.getUsername() : null;
        String displayName = user != null ? user.getDisplayName() : null;
        String avatarUrl = user != null ? user.getAvatarUrl() : null;
        return new OrgMemberResponse(
                member.getUserId(),
                username,
                displayName,
                avatarUrl,
                member.getRole(),
                member.getAcceptedAt()
        );
    }

}
