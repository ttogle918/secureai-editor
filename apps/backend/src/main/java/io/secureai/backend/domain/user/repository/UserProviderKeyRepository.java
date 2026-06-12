package io.secureai.backend.domain.user.repository;

import io.secureai.backend.domain.user.entity.UserProviderKey;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserProviderKeyRepository extends JpaRepository<UserProviderKey, UUID> {

    List<UserProviderKey> findAllByUserId(UUID userId);

    Optional<UserProviderKey> findByUserIdAndProvider(UUID userId, String provider);

    void deleteByUserIdAndProvider(UUID userId, String provider);
}
