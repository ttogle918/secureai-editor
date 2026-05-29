package io.secureai.backend.domain.user.service;

import io.secureai.backend.domain.user.dto.*;
import io.secureai.backend.domain.user.entity.User;
import io.secureai.backend.domain.user.repository.RefreshTokenRepository;
import io.secureai.backend.domain.user.repository.UserRepository;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import io.secureai.backend.global.model.ModelConstants;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
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

    /** 온보딩 Step 0 — 워크스페이스 모드(DEVELOPER/SECURITY_MANAGER/BOTH) 저장. 값 검증은 Controller @Pattern 에서 수행. */
    @Transactional
    public UserMeResponse updateWorkspaceMode(UUID userId, String workspaceMode) {
        User user = loadUser(userId);
        user.setWorkspaceMode(workspaceMode);
        userRepository.save(user);
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

    @Transactional(readOnly = true)
    public CreditSummaryResponse getCredits(UUID userId) {
        return CreditSummaryResponse.from(loadUser(userId));
    }

    @Transactional
    public void saveApiKey(UUID userId, String rawApiKey) {
        User user = loadUser(userId);
        user.setAnthropicApiKey(rawApiKey);   // AesEncryptionConverter가 자동 암호화
        userRepository.save(user);
    }

    @Transactional
    public void removeApiKey(UUID userId) {
        User user = loadUser(userId);
        user.setAnthropicApiKey(null);
        userRepository.save(user);
    }

    @Transactional
    public CreditSummaryResponse updateSettings(UUID userId, UpdateSettingsRequest request) {
        request.validate();
        User user = loadUser(userId);
        user.setPreferredModel(request.preferredModel());
        userRepository.save(user);
        return CreditSummaryResponse.from(user);
    }

    /** 분석 시작 전 사용자의 복호화된 API 키와 선호 모델을 반환한다. */
    @Transactional(readOnly = true)
    public UserAnalysisSettings getAnalysisSettings(UUID userId) {
        User user = loadUser(userId);
        return new UserAnalysisSettings(
                user.getPreferredModel(),
                user.getAnthropicApiKey()   // 이미 복호화된 상태로 반환됨
        );
    }

    public record UserAnalysisSettings(String preferredModel, String apiKey) {}

    // ── 크로스 도메인 파사드 (analysis/organization 도메인에서 사용) ───────────

    @Transactional(readOnly = true)
    public User findOrThrow(UUID userId) {
        return loadUser(userId);
    }

    @Transactional(readOnly = true)
    public List<User> findAllByIds(List<UUID> userIds) {
        return userRepository.findAllById(userIds);
    }

    /** GitHub 토큰을 복호화해서 반환한다. AesEncryptionConverter가 자동 복호화. */
    @Transactional(readOnly = true)
    public String getDecryptedGithubToken(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
        return user.getGithubToken();
    }

    /**
     * GitHub 연동 설정(blockMergeOnCritical)을 저장한다.
     */
    @Transactional
    public void saveGithubSettings(UUID userId, GitHubSettingsRequest request) {
        User user = loadUser(userId);
        user.setGithubBlockMergeOnCritical(request.blockMergeOnCritical());
        userRepository.save(user);
    }

    private User loadUser(UUID userId) {
        return userRepository.findByIdWithPlan(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
    }

    private void evictUserCache(UUID userId) {
        redisTemplate.delete("secureai:user:%s:plan".formatted(userId));
    }
}
