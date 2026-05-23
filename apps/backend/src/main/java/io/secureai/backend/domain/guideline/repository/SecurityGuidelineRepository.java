package io.secureai.backend.domain.guideline.repository;

import io.secureai.backend.domain.guideline.entity.SecurityGuideline;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface SecurityGuidelineRepository extends JpaRepository<SecurityGuideline, UUID> {
}
