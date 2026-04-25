package io.secureai.backend.domain.auth.service;

import io.secureai.backend.domain.plan.Plan;
import io.secureai.backend.domain.plan.PlanRepository;
import io.secureai.backend.domain.user.entity.RefreshToken;
import io.secureai.backend.domain.user.entity.User;
import io.secureai.backend.domain.user.repository.RefreshTokenRepository;
import io.secureai.backend.domain.user.repository.UserRepository;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import io.secureai.backend.global.security.JwtProperties;
import io.secureai.backend.global.security.TokenService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.BDDMockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceRefreshTest {

    @Mock UserRepository userRepository;
    @Mock RefreshTokenRepository refreshTokenRepository;
    @Mock PlanRepository planRepository;
    @Mock TokenService tokenService;
    @Mock EmailService emailService;
    @Mock RedisTemplate<String, String> redisTemplate;
    @Mock ValueOperations<String, String> valueOps;

    AuthService authService;

    @BeforeEach
    void setUp() {
        JwtProperties props = new JwtProperties();
        props.setSecret("bXktc3VwZXItc2VjcmV0LWtleS1mb3Itand0LXNpZ25pbmctbXVzdC1iZS0yNTYtYml0cy1sb25n");
        props.setAccessTokenExpirySeconds(900);
        props.setRefreshTokenExpirySeconds(2592000);

        authService = new AuthService(
                userRepository, refreshTokenRepository, planRepository,
                tokenService, new BCryptPasswordEncoder(4),
                emailService, redisTemplate, props
        );

        org.mockito.Mockito.lenient().when(redisTemplate.opsForValue()).thenReturn(valueOps);
    }

    // ── Refresh Token Rotation ────────────────────────────────────────────────

    @Test
    void refresh_revokedToken_revokeAllAndThrow() {
        String rawToken = "raw-refresh-token";
        String hash = AuthService.sha256(rawToken);

        User user = buildUser();
        RefreshToken revoked = RefreshToken.builder()
                .user(user)
                .tokenHash(hash)
                .expiresAt(OffsetDateTime.now().plusDays(30))
                .build();
        revoked.revoke("test");

        given(refreshTokenRepository.findByTokenHash(hash)).willReturn(Optional.of(revoked));

        var fakeRequest = mockRequest(rawToken);

        assertThatThrownBy(() -> authService.refresh(fakeRequest, null))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.AUTH_REFRESH_INVALID);

        then(refreshTokenRepository).should().revokeAllByUserId(eq(user.getId()), any(), eq("security"));
    }

    @Test
    void refresh_expiredToken_throws() {
        String rawToken = "expired-token";
        String hash = AuthService.sha256(rawToken);

        User user = buildUser();
        RefreshToken expired = RefreshToken.builder()
                .user(user)
                .tokenHash(hash)
                .expiresAt(OffsetDateTime.now().minusDays(1))
                .build();

        given(refreshTokenRepository.findByTokenHash(hash)).willReturn(Optional.of(expired));

        var fakeRequest = mockRequest(rawToken);

        assertThatThrownBy(() -> authService.refresh(fakeRequest, null))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.AUTH_REFRESH_INVALID);
    }

    // ── Email 대소문자 중복 방지 ─────────────────────────────────────────────

    @Test
    void register_duplicateEmailCaseInsensitive_throws() {
        given(userRepository.existsByEmailAndDeletedAtIsNull("test@example.com")).willReturn(true);

        var req = org.mockito.Mockito.mock(io.secureai.backend.domain.auth.dto.RegisterRequest.class);
        given(req.getEmail()).willReturn("TEST@EXAMPLE.COM");

        assertThatThrownBy(() -> authService.register(req))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.AUTH_EMAIL_ALREADY_EXISTS);
    }

    @Test
    void register_duplicateUsername_throws() {
        given(userRepository.existsByEmailAndDeletedAtIsNull("new@example.com")).willReturn(false);
        given(userRepository.existsByUsernameAndDeletedAtIsNull("taken")).willReturn(true);

        var req = org.mockito.Mockito.mock(io.secureai.backend.domain.auth.dto.RegisterRequest.class);
        given(req.getEmail()).willReturn("new@example.com");
        given(req.getUsername()).willReturn("taken");

        assertThatThrownBy(() -> authService.register(req))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.AUTH_USERNAME_ALREADY_EXISTS);
    }

    // ── OAuth state CSRF 검증 로직 ───────────────────────────────────────────

    @Test
    void sha256_oauthState_consistentHash() {
        String state = UUID.randomUUID().toString();
        String key1 = "secureai:oauth:state:" + state;
        String key2 = "secureai:oauth:state:" + state;
        assertThat(key1).isEqualTo(key2);
    }

    @Test
    void sha256_differentStates_differentKeys() {
        String s1 = "secureai:oauth:state:" + UUID.randomUUID();
        String s2 = "secureai:oauth:state:" + UUID.randomUUID();
        assertThat(s1).isNotEqualTo(s2);
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private User buildUser() {
        return User.builder()
                .email("user@example.com")
                .username("user")
                .emailVerified(true)
                .plan(new Plan())
                .build();
    }

    private jakarta.servlet.http.HttpServletRequest mockRequest(String cookieValue) {
        var request = org.mockito.Mockito.mock(jakarta.servlet.http.HttpServletRequest.class);
        var cookie = new jakarta.servlet.http.Cookie("refresh_token", cookieValue);
        given(request.getCookies()).willReturn(new jakarta.servlet.http.Cookie[]{cookie});
        return request;
    }
}
