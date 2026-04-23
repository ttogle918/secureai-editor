package io.secureai.backend.domain.user.service;

import io.secureai.backend.domain.user.dto.UpdateUserRequest;
import io.secureai.backend.domain.user.dto.UserMeResponse;
import io.secureai.backend.domain.user.entity.User;
import io.secureai.backend.domain.user.repository.RefreshTokenRepository;
import io.secureai.backend.domain.user.repository.UserRepository;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final RedisTemplate<String, String> redisTemplate;

    @Transactional(readOnly = true)
    public UserMeResponse getMe(UUID userId) {
        User user = loadUser(userId);
        return UserMeResponse.from(user);
    }

    @Transactional
    public UserMeResponse updateMe(UUID userId, UpdateUserRequest request) {
        User user = loadUser(userId);
        if (request.getDisplayName() != null) user.setDisplayName(request.getDisplayName());
        if (request.getTimezone() != null) user.setTimezone(request.getTimezone());
        if (request.getLocale() != null) user.setLocale(request.getLocale());
        userRepository.save(user);
        evictUserCache(userId);
        return UserMeResponse.from(user);
    }

    @Transactional
    public void changePassword(UUID userId, String currentPassword, String newPassword) {
        User user = loadUser(userId);
        if (user.getPasswordHash() == null || !passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw new BusinessException(ErrorCode.USER_INVALID_PASSWORD);
        }
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(user);
        refreshTokenRepository.revokeAllByUserId(userId, OffsetDateTime.now(), "password_change");
    }

    @Transactional
    public void deleteMe(UUID userId, String confirmPassword) {
        User user = loadUser(userId);
        if (user.getPasswordHash() != null && !passwordEncoder.matches(confirmPassword, user.getPasswordHash())) {
            throw new BusinessException(ErrorCode.USER_INVALID_PASSWORD);
        }
        user.setDeletedAt(OffsetDateTime.now());
        user.setGithubToken(null);
        userRepository.save(user);
        refreshTokenRepository.revokeAllByUserId(userId, OffsetDateTime.now(), "account_deleted");
        evictUserCache(userId);
        // TODO Sprint 4: 30일 후 하드 삭제 스케줄 등록
    }

    private User loadUser(UUID userId) {
        return userRepository.findByIdWithPlan(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
    }

    private void evictUserCache(UUID userId) {
        redisTemplate.delete("secureai:user:%s:plan".formatted(userId));
    }
}
