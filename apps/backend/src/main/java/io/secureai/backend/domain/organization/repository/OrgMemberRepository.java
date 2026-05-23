package io.secureai.backend.domain.organization.repository;

import io.secureai.backend.domain.organization.entity.OrgMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface OrgMemberRepository extends JpaRepository<OrgMember, UUID> {

    Optional<OrgMember> findByOrgIdAndUserId(UUID orgId, UUID userId);

    List<OrgMember> findByOrgId(UUID orgId);

    List<OrgMember> findByUserId(UUID userId);

    long countByOrgIdAndAcceptedAtIsNotNull(UUID orgId);
}
