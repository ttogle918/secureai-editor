package io.secureai.backend.global.security;

import io.secureai.backend.domain.organization.repository.OrgMemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.UUID;

/**
 * SpEL 기반 조직(Organization) 멤버십 권한 검증 컴포넌트.
 *
 * 사용 예:
 * {@code @PreAuthorize("@orgGuard.isAdminOrAbove(authentication, #orgId)")}
 * {@code @PreAuthorize("@orgGuard.isMember(authentication, #orgId)")}
 */
@Component
@RequiredArgsConstructor
public class OrgGuard {

    private final OrgMemberRepository orgMemberRepository;

    private static final List<String> ADMIN_ROLES = List.of("owner", "admin");

    /**
     * 조직에서 admin 이상 역할(owner, admin)을 가진 수락된 멤버인지 확인한다.
     *
     * @param auth  Spring Security Authentication 객체
     * @param orgId 조직 UUID
     * @return admin 이상 역할의 수락된 멤버면 true, 그 외 false
     */
    public boolean isAdminOrAbove(Authentication auth, UUID orgId) {
        UUID userId = (UUID) auth.getPrincipal();
        return orgMemberRepository.findByOrgIdAndUserId(orgId, userId)
                .map(m -> m.getAcceptedAt() != null && ADMIN_ROLES.contains(m.getRole()))
                .orElse(false);
    }

    /**
     * 조직의 수락된 멤버인지 확인한다 (역할 무관).
     *
     * @param auth  Spring Security Authentication 객체
     * @param orgId 조직 UUID
     * @return 수락된 멤버면 true, 그 외 false
     */
    public boolean isMember(Authentication auth, UUID orgId) {
        UUID userId = (UUID) auth.getPrincipal();
        return orgMemberRepository.findByOrgIdAndUserId(orgId, userId)
                .map(m -> m.getAcceptedAt() != null)
                .orElse(false);
    }
}
