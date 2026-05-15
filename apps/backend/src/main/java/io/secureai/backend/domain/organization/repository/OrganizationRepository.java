package io.secureai.backend.domain.organization.repository;

import io.secureai.backend.domain.organization.entity.Organization;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface OrganizationRepository extends JpaRepository<Organization, UUID> {

    Optional<Organization> findBySlugAndDeletedAtIsNull(String slug);

    List<Organization> findByOwnerIdAndDeletedAtIsNull(UUID ownerId);

    @Query("SELECT o FROM Organization o JOIN OrgMember om ON o.id = om.orgId " +
           "WHERE om.userId = :userId AND o.deletedAt IS NULL AND om.acceptedAt IS NOT NULL")
    List<Organization> findAllByMemberUserId(@Param("userId") UUID userId);
}
