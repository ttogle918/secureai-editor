package io.secureai.backend.domain.auth.service;

import io.secureai.backend.domain.auth.dto.*;
import io.secureai.backend.domain.plan.PlanRepository;
import io.secureai.backend.domain.user.entity.RefreshToken;
import io.secureai.backend.domain.user.entity.User;
import io.secureai.backend.domain.user.repository.RefreshTokenRepository;
import io.secureai.backend.domain.user.repository.UserRepository;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import io.secureai.backend.global.security.JwtProperties;
import io.secureai.backend.global.security.TokenService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.WebUtils;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private static final int MAX_LOGIN_FAIL = 5;
    private static final int LOCK_MINUTES = 15;
    private static final String REFRESH_COOKIE = "refresh_token";

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PlanRepository planRepository;
    private final TokenService tokenService;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;
    private final RedisTemplate<String, String> redisTemplate;
    private final JwtProperties jwtProperties;

    @Transactional
    public RegisterResponse register(RegisterRequest request) {
        if (userRepository.existsByEmailAndDeletedAtIsNull(request.getEmail().toLowerCase())) {
            throw new BusinessException(ErrorCode.AUTH_EMAIL_ALREADY_EXISTS);
        }
        if (userRepository.existsByUsernameAndDeletedAtIsNull(request.getUsername())) {
            throw new BusinessException(ErrorCode.AUTH_USERNAME_ALREADY_EXISTS);
        }

        String verifyToken = UUID.randomUUID().toString().replace("-", "");
        User user = User.builder()
                .email(request.getEmail().toLowerCase())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .username(request.getUsername())
                .displayName(request.getDisplayName())
                .emailVerifyToken(verifyToken)
                .emailVerifyExpiresAt(OffsetDateTime.now().plusHours(24))
                .plan(planRepository.findByName("free")
                        .orElseThrow(() -> new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR)))
                .build();
        userRepository.save(user);

        emailService.sendVerificationEmail(user.getEmail(), verifyToken);

        return new RegisterResponse(user.getId(), user.getEmail(), user.getUsername());
    }

    @Transactional
    public void verifyEmail(String token) {
        User user = userRepository.findByEmailVerifyTokenAndDeletedAtIsNull(token)
                .orElseThrow(() -> new BusinessException(ErrorCode.AUTH_TOKEN_EXPIRED, "유효하지 않은 인증 토큰입니다."));

        if (user.getEmailVerifyExpiresAt().isBefore(OffsetDateTime.now())) {
            throw new BusinessException(ErrorCode.AUTH_TOKEN_EXPIRED, "인증 토큰이 만료되었습니다.");
        }

        user.setEmailVerified(true);
        user.setEmailVerifyToken(null);
        user.setEmailVerifyExpiresAt(null);
        userRepository.save(user);
    }

    @Transactional
    public LoginResponse login(LoginRequest request, HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        User user = userRepository.findByEmailAndDeletedAtIsNull(request.getEmail().toLowerCase())
                .orElseThrow(() -> new BusinessException(ErrorCode.AUTH_INVALID_CREDENTIALS));

        if (user.getLockedUntil() != null && user.getLockedUntil().isAfter(OffsetDateTime.now())) {
            throw new BusinessException(ErrorCode.AUTH_ACCOUNT_LOCKED);
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            incrementLoginFail(user);
            throw new BusinessException(ErrorCode.AUTH_INVALID_CREDENTIALS);
        }

        if (!user.getEmailVerified()) {
            throw new BusinessException(ErrorCode.AUTH_EMAIL_NOT_VERIFIED);
        }

        user.setLoginFailCount((short) 0);
        user.setLockedUntil(null);
        user.setLastLoginAt(OffsetDateTime.now());
        userRepository.save(user);

        String accessToken = tokenService.generateAccessToken(user.getId(), user.getEmail());
        String rawRefreshToken = issueRefreshToken(user, httpRequest);
        setRefreshCookie(rawRefreshToken, httpResponse);

        return new LoginResponse(accessToken, "Bearer", jwtProperties.getAccessTokenExpirySeconds(), user);
    }

    @Transactional
    public TokenRefreshResponse refresh(HttpServletRequest request, HttpServletResponse response) {
        String rawToken = extractRefreshCookie(request);
        if (rawToken == null) {
            throw new BusinessException(ErrorCode.AUTH_REFRESH_INVALID);
        }

        String hash = sha256(rawToken);
        RefreshToken stored = refreshTokenRepository.findByTokenHash(hash)
                .orElseThrow(() -> new BusinessException(ErrorCode.AUTH_REFRESH_INVALID));

        if (stored.isRevoked() || stored.isExpired()) {
            // 재사용 감지 시 해당 사용자 전체 토큰 폐기 (보안 강화)
            refreshTokenRepository.revokeAllByUserId(stored.getUser().getId(), OffsetDateTime.now(), "security");
            throw new BusinessException(ErrorCode.AUTH_REFRESH_INVALID, "Refresh Token 재사용이 감지되었습니다.");
        }

        stored.revoke("rotation");
        refreshTokenRepository.save(stored);

        User user = stored.getUser();
        String newAccessToken = tokenService.generateAccessToken(user.getId(), user.getEmail());
        String newRawRefresh = issueRefreshToken(user, request);
        setRefreshCookie(newRawRefresh, response);

        return new TokenRefreshResponse(newAccessToken, jwtProperties.getAccessTokenExpirySeconds());
    }

    @Transactional
    public void logout(UUID userId, HttpServletRequest request, HttpServletResponse response) {
        String rawToken = extractRefreshCookie(request);
        if (rawToken != null) {
            String hash = sha256(rawToken);
            refreshTokenRepository.findByTokenHash(hash).ifPresent(rt -> {
                rt.revoke("logout");
                refreshTokenRepository.save(rt);
            });
        }
        // Redis 캐시 무효화
        redisTemplate.delete("secureai:user:%s:plan".formatted(userId));
        clearRefreshCookie(response);
    }

    @Transactional
    public LoginResponse loginWithUser(User user, HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        // plan 포함 재조회 — 트랜잭션 경계를 넘어온 user의 lazy proxy 방지
        User freshUser = userRepository.findByIdWithPlan(user.getId())
                .orElse(user);
        freshUser.setLastLoginAt(OffsetDateTime.now());
        userRepository.save(freshUser);
        String accessToken = tokenService.generateAccessToken(freshUser.getId(), freshUser.getEmail());
        String rawRefreshToken = issueRefreshToken(freshUser, httpRequest);
        setRefreshCookie(rawRefreshToken, httpResponse);
        return new LoginResponse(accessToken, "Bearer", jwtProperties.getAccessTokenExpirySeconds(), freshUser);
    }

    @Transactional
    public void forgotPassword(String email) {
        // 존재 여부 비노출 (타이밍 공격 방어)
        userRepository.findByEmailAndDeletedAtIsNull(email.toLowerCase()).ifPresent(user -> {
            String token = UUID.randomUUID().toString().replace("-", "");
            user.setEmailVerifyToken(token);
            user.setEmailVerifyExpiresAt(OffsetDateTime.now().plusHours(1));
            userRepository.save(user);
            emailService.sendPasswordResetEmail(user.getEmail(), token);
        });
    }

    @Transactional
    public void resetPassword(ResetPasswordRequest request) {
        User user = userRepository.findByEmailVerifyTokenAndDeletedAtIsNull(request.getToken())
                .orElseThrow(() -> new BusinessException(ErrorCode.AUTH_TOKEN_EXPIRED, "유효하지 않은 토큰입니다."));

        if (user.getEmailVerifyExpiresAt().isBefore(OffsetDateTime.now())) {
            throw new BusinessException(ErrorCode.AUTH_TOKEN_EXPIRED, "토큰이 만료되었습니다.");
        }

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        user.setEmailVerifyToken(null);
        user.setEmailVerifyExpiresAt(null);
        userRepository.save(user);

        refreshTokenRepository.revokeAllByUserId(user.getId(), OffsetDateTime.now(), "password_reset");
    }

    private void incrementLoginFail(User user) {
        short fails = (short) (user.getLoginFailCount() + 1);
        user.setLoginFailCount(fails);
        if (fails >= MAX_LOGIN_FAIL) {
            user.setLockedUntil(OffsetDateTime.now().plusMinutes(LOCK_MINUTES));
        }
        userRepository.save(user);
    }

    private String issueRefreshToken(User user, HttpServletRequest request) {
        String raw = tokenService.generateRefreshToken();
        String hash = sha256(raw);
        String deviceInfo = request.getHeader("User-Agent");
        if (deviceInfo != null && deviceInfo.length() > 255) {
            deviceInfo = deviceInfo.substring(0, 255);
        }

        RefreshToken rt = RefreshToken.builder()
                .user(user)
                .tokenHash(hash)
                .deviceInfo(deviceInfo)
                .ipAddress(request.getRemoteAddr())
                .expiresAt(OffsetDateTime.now().plusSeconds(jwtProperties.getRefreshTokenExpirySeconds()))
                .build();
        refreshTokenRepository.save(rt);

        // Redis에도 캐시 (빠른 검증용)
        redisTemplate.opsForValue().set(
                "secureai:refresh:%s".formatted(hash), user.getId().toString(),
                Duration.ofSeconds(jwtProperties.getRefreshTokenExpirySeconds())
        );
        return raw;
    }

    private void setRefreshCookie(String token, HttpServletResponse response) {
        Cookie cookie = new Cookie(REFRESH_COOKIE, token);
        cookie.setHttpOnly(true);
        cookie.setSecure(true);
        cookie.setPath("/api/v1/auth");
        cookie.setMaxAge((int) jwtProperties.getRefreshTokenExpirySeconds());
        cookie.setAttribute("SameSite", "Strict");
        response.addCookie(cookie);
    }

    private void clearRefreshCookie(HttpServletResponse response) {
        Cookie cookie = new Cookie(REFRESH_COOKIE, "");
        cookie.setHttpOnly(true);
        cookie.setSecure(true);
        cookie.setPath("/api/v1/auth");
        cookie.setMaxAge(0);
        response.addCookie(cookie);
    }

    private String extractRefreshCookie(HttpServletRequest request) {
        Cookie cookie = WebUtils.getCookie(request, REFRESH_COOKIE);
        return cookie != null ? cookie.getValue() : null;
    }

    static String sha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : hash) sb.append("%02x".formatted(b));
            return sb.toString();
        } catch (Exception e) {
            throw new RuntimeException("SHA-256 failed", e);
        }
    }
}
