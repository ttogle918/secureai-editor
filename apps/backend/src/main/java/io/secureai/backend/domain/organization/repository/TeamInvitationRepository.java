package io.secureai.backend.domain.organization.repository;

import io.secureai.backend.domain.organization.entity.TeamInvitation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TeamInvitationRepository extends JpaRepository<TeamInvitation, UUID> {

    Optional<TeamInvitation> findByTokenAndAcceptedAtIsNull(String token);

    List<TeamInvitation> findByEmailAndOrgIdAndAcceptedAtIsNull(String email, UUID orgId);
}
