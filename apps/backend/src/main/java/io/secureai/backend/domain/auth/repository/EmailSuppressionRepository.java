package io.secureai.backend.domain.auth.repository;

import io.secureai.backend.domain.auth.entity.EmailSuppression;
import io.secureai.backend.domain.auth.entity.SuppressionReason;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface EmailSuppressionRepository extends JpaRepository<EmailSuppression, UUID> {

    boolean existsByEmailAddress(String emailAddress);

    Optional<EmailSuppression> findByEmailAddress(String emailAddress);

    /** 바운스/스팸으로 이미 등록된 경우 upsert 시 중복 방지용. */
    boolean existsByEmailAddressAndReason(String emailAddress, SuppressionReason reason);
}
