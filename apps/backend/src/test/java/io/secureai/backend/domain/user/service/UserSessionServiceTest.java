package io.secureai.backend.domain.user.service;

import io.secureai.backend.domain.user.dto.SessionResponse;
import io.secureai.backend.domain.user.entity.User;
import io.secureai.backend.domain.user.entity.UserSession;
import io.secureai.backend.domain.user.repository.UserSessionRepository;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserSessionServiceTest {

    @Mock UserSessionRepository userSessionRepository;
    @Mock StringRedisTemplate stringRedisTemplate;
    @Mock ValueOperations<String, String> valueOperations;

    @InjectMocks UserSessionService userSessionService;

    private User owner;
    private User anotherUser;
    private UserSession activeSession;

    @BeforeEach
    void setUp() {
        owner = User.builder().build();
        setField(owner, "id", UUID.randomUUID());

        anotherUser = User.builder().build();
        setField(anotherUser, "id", UUID.randomUUID());

        activeSession = UserSession.builder()
                .user(owner)
                .jwtJti("test-jti-abc")
                .deviceInfo("Mozilla/5.0")
                .ip("127.0.0.1")
                .userAgent("Mozilla/5.0")
                .expiresAt(OffsetDateTime.now().plusHours(1))
                .build();
        setField(activeSession, "id", UUID.randomUUID());
        setField(activeSession, "createdAt", OffsetDateTime.now());
    }

    @Test
    @DisplayName("getActiveSessions: userId로 활성 세션 목록 반환")
    void getActiveSessions_returnsActiveSessionsForUser() {
        UUID userId = owner.getId();
        when(userSessionRepository.findActiveByUserId(userId)).thenReturn(List.of(activeSession));

        List<SessionResponse> result = userSessionService.getActiveSessions(userId);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).ip()).isEqualTo("127.0.0.1");
    }

    @Test
    @DisplayName("revokeSession: 소유자가 자신의 세션을 취소하면 블랙리스트에 등록")
    void revokeSession_ownerRevokes_blacklistsJti() {
        UUID sessionId = activeSession.getId();
        UUID userId = owner.getId();
        when(userSessionRepository.findById(sessionId)).thenReturn(Optional.of(activeSession));
        when(stringRedisTemplate.opsForValue()).thenReturn(valueOperations);

        userSessionService.revokeSession(sessionId, userId);

        verify(userSessionRepository).save(activeSession);
        verify(valueOperations).set(eq("secureai:jwt:blacklist:test-jti-abc"), eq("1"), any());
    }

    @Test
    @DisplayName("revokeSession: 타 사용자가 세션 취소 시도 → 403 예외")
    void revokeSession_nonOwner_throws403() {
        UUID sessionId = activeSession.getId();
        UUID otherUserId = anotherUser.getId();
        when(userSessionRepository.findById(sessionId)).thenReturn(Optional.of(activeSession));

        assertThatThrownBy(() -> userSessionService.revokeSession(sessionId, otherUserId))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getErrorCode())
                        .isEqualTo(ErrorCode.USER_SESSION_ACCESS_DENIED));
    }

    @Test
    @DisplayName("revokeSession: 세션 없으면 404 예외")
    void revokeSession_sessionNotFound_throws404() {
        UUID sessionId = UUID.randomUUID();
        UUID userId = owner.getId();
        when(userSessionRepository.findById(sessionId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userSessionService.revokeSession(sessionId, userId))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getErrorCode())
                        .isEqualTo(ErrorCode.USER_SESSION_NOT_FOUND));
    }

    @Test
    @DisplayName("isJtiBlacklisted: Redis에 키 없으면 false")
    void isJtiBlacklisted_noKey_returnsFalse() {
        when(stringRedisTemplate.hasKey("secureai:jwt:blacklist:some-jti")).thenReturn(false);

        assertThat(userSessionService.isJtiBlacklisted("some-jti")).isFalse();
    }

    @Test
    @DisplayName("isJtiBlacklisted: Redis에 키 있으면 true")
    void isJtiBlacklisted_keyPresent_returnsTrue() {
        when(stringRedisTemplate.hasKey("secureai:jwt:blacklist:blocked-jti")).thenReturn(true);

        assertThat(userSessionService.isJtiBlacklisted("blocked-jti")).isTrue();
    }

    /** 테스트에서 private final 필드에 리플렉션으로 값 주입 */
    private static void setField(Object target, String fieldName, Object value) {
        try {
            var field = findField(target.getClass(), fieldName);
            field.setAccessible(true);
            field.set(target, value);
        } catch (Exception e) {
            throw new RuntimeException("setField failed: " + fieldName, e);
        }
    }

    private static java.lang.reflect.Field findField(Class<?> clazz, String name) throws NoSuchFieldException {
        if (clazz == null) throw new NoSuchFieldException(name);
        try {
            return clazz.getDeclaredField(name);
        } catch (NoSuchFieldException e) {
            return findField(clazz.getSuperclass(), name);
        }
    }
}
