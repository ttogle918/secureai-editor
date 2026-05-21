package io.secureai.backend.domain.notification.repository;

import io.secureai.backend.domain.notification.entity.DeviceToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface DeviceTokenRepository extends JpaRepository<DeviceToken, UUID> {

    List<DeviceToken> findByUserId(UUID userId);

    @Modifying
    @Query("DELETE FROM DeviceToken dt WHERE dt.user.id = :userId AND dt.token = :token")
    void deleteByUserIdAndToken(@Param("userId") UUID userId, @Param("token") String token);

    boolean existsByUserIdAndToken(UUID userId, String token);
}
