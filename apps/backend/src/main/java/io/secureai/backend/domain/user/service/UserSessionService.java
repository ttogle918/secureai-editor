package io.secureai.backend.domain.user.service;

import io.secureai.backend.domain.user.dto.SessionResponse;
import io.secureai.backend.domain.user.entity.User;
import io.secureai.backend.domain.user.entity.UserSession;
import io.secureai.backend.domain.user.repository.UserSessionRepository;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserSessionService {

    private static final String BLACKLIST_KEY_PREFIX = "secureai:jwt:blacklist:";

    private final UserSessionRepository userSessionRepository;
    private final StringRedisTemplate stringRedisTemplate;

    @Transactional(readOnly = true)
    public List<SessionResponse> getActiveSessions(UUID userId) {
        return userSessionRepository.findActiveByUserId(userId)
                .stream()
                .map(SessionResponse::from)
                .toList();
    }

    @Transactional
    public void revokeSession(UUID sessionId, UUID requestingUserId) {
        UserSession session = userSessionRepository.findById(sessionId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_SESSION_NOT_FOUND));

        if (!session.getUser().getId().equals(requestingUserId)) {
            throw new BusinessException(ErrorCode.USER_SESSION_ACCESS_DENIED);
        }

        if (!session.isActive()) {
            return;
        }

        session.revoke();
        userSessionRepository.save(session);

        blacklistJti(session.getJwtJti(), session.getExpiresAt());
        log.debug("Session revoked: sessionId={}", sessionId);
    }

    @Transactional
    public void createSession(User user, String jti, String deviceInfo, String ip,
                              String userAgent, OffsetDateTime expiresAt) {
        String truncatedDeviceInfo = truncate(deviceInfo, 500);
        String truncatedUserAgent  = truncate(userAgent, 500);

        UserSession session = UserSession.builder()
                .user(user)
                .jwtJti(jti)
                .deviceInfo(truncatedDeviceInfo)
                .ip(ip)
                .userAgent(truncatedUserAgent)
                .expiresAt(expiresAt)
                .build();
        userSessionRepository.save(session);
    }

    public boolean isJtiBlacklisted(String jti) {
        return Boolean.TRUE.equals(stringRedisTemplate.hasKey(BLACKLIST_KEY_PREFIX + jti));
    }

    private void blacklistJti(String jti, OffsetDateTime expiresAt) {
        Duration ttl = Duration.between(OffsetDateTime.now(), expiresAt);
        if (ttl.isPositive()) {
            stringRedisTemplate.opsForValue().set(BLACKLIST_KEY_PREFIX + jti, "1", ttl);
        }
    }

    private String truncate(String value, int maxLength) {
        if (value == null) return null;
        return value.length() > maxLength ? value.substring(0, maxLength) : value;
    }
}
