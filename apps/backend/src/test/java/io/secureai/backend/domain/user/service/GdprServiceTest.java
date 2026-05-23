package io.secureai.backend.domain.user.service;

import io.secureai.backend.domain.user.dto.GdprExportResponse;
import io.secureai.backend.domain.user.entity.User;
import io.secureai.backend.domain.user.repository.RefreshTokenRepository;
import io.secureai.backend.domain.user.repository.UserRepository;
import io.secureai.backend.global.aop.AuditLogRepository;
import io.secureai.backend.global.event.GdprAccountDeletedEvent;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.BDDMockito.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class GdprServiceTest {

    @Mock UserRepository userRepository;
    @Mock RefreshTokenRepository refreshTokenRepository;
    @Mock AuditLogRepository auditLogRepository;
    @Mock PasswordEncoder passwordEncoder;
    @Mock ApplicationEventPublisher eventPublisher;

    @InjectMocks GdprService gdprService;

    private UUID userId;
    private User user;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        user = mock(User.class);
    }

    // ── exportData ────────────────────────────────────────────────────────────

    @Test
    @DisplayName("exportData — 존재하는 사용자의 DTO가 반환된다")
    void exportData_existingUser_returnsDto() {
        // given
        given(userRepository.findByIdWithPlan(userId)).willReturn(Optional.of(user));
        given(user.getId()).willReturn(userId);
        given(user.getEmail()).willReturn("user@example.com");
        given(user.getUsername()).willReturn("testuser");
        given(user.getDisplayName()).willReturn("Test User");
        given(user.getGithubLogin()).willReturn("gh-user");
        given(user.getTimezone()).willReturn("Asia/Seoul");
        given(user.getLocale()).willReturn("ko");
        given(user.getPublicProfile()).willReturn(false);
        given(user.getEmailVerified()).willReturn(true);
        given(user.getIsActive()).willReturn(true);
        given(user.getGithubId()).willReturn(12345L);
        given(user.getAnthropicApiKey()).willReturn("enc-key");
        given(user.getCreatedAt()).willReturn(OffsetDateTime.now().minusDays(30));
        given(user.getUpdatedAt()).willReturn(OffsetDateTime.now().minusDays(1));

        // when
        GdprExportResponse result = gdprService.exportData(userId);

        // then
        assertThat(result).isNotNull();
        assertThat(result.getId()).isEqualTo(userId);
        assertThat(result.getEmail()).isEqualTo("user@example.com");
        assertThat(result.getUsername()).isEqualTo("testuser");
        assertThat(result.isHasGithubLinked()).isTrue();
        assertThat(result.isHasByok()).isTrue();
        assertThat(result.getExportedAt()).isNotNull();
    }

    @Test
    @DisplayName("exportData — 사용자가 없으면 USER_NOT_FOUND 예외가 발생한다")
    void exportData_userNotFound_throwsBusinessException() {
        // given
        given(userRepository.findByIdWithPlan(userId)).willReturn(Optional.empty());

        // when & then
        assertThatThrownBy(() -> gdprService.exportData(userId))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.USER_NOT_FOUND);
    }

    @Test
    @DisplayName("exportData — GitHub 미연동·BYOK 미설정 사용자는 false가 반환된다")
    void exportData_noGithubNoBYOK_returnsFalseFlags() {
        // given
        given(userRepository.findByIdWithPlan(userId)).willReturn(Optional.of(user));
        given(user.getId()).willReturn(userId);
        given(user.getEmail()).willReturn("user@example.com");
        given(user.getUsername()).willReturn("testuser");
        given(user.getTimezone()).willReturn("Asia/Seoul");
        given(user.getLocale()).willReturn("ko");
        given(user.getPublicProfile()).willReturn(false);
        given(user.getEmailVerified()).willReturn(false);
        given(user.getIsActive()).willReturn(true);
        given(user.getGithubId()).willReturn(null);
        given(user.getAnthropicApiKey()).willReturn(null);
        given(user.getCreatedAt()).willReturn(OffsetDateTime.now());
        given(user.getUpdatedAt()).willReturn(OffsetDateTime.now());

        // when
        GdprExportResponse result = gdprService.exportData(userId);

        // then
        assertThat(result.isHasGithubLinked()).isFalse();
        assertThat(result.isHasByok()).isFalse();
    }

    // ── deleteAccount ─────────────────────────────────────────────────────────

    @Test
    @DisplayName("deleteAccount — 삭제 순서: reports → refreshTokens → users 순서로 호출된다")
    void deleteAccount_hardDelete_deletesInCorrectOrder() {
        // given
        given(userRepository.findByIdWithPlan(userId)).willReturn(Optional.of(user));
        given(user.getPasswordHash()).willReturn("$2a$12$hashedPassword");
        given(passwordEncoder.matches("correct-password", "$2a$12$hashedPassword")).willReturn(true);

        // when
        gdprService.deleteAccount(userId, "correct-password");

        // then — 삭제 순서 검증 (event → refreshTokens → users)
        InOrder inOrder = inOrder(eventPublisher, refreshTokenRepository, userRepository);
        inOrder.verify(eventPublisher).publishEvent(argThat((Object e) ->
                e instanceof GdprAccountDeletedEvent evt && evt.userId().equals(userId)));
        inOrder.verify(refreshTokenRepository).revokeAllByUserId(eq(userId), any(OffsetDateTime.class), eq("gdpr_delete"));
        inOrder.verify(userRepository).deleteById(userId);
    }

    @Test
    @DisplayName("deleteAccount — 잘못된 비밀번호이면 USER_INVALID_PASSWORD 예외가 발생하고 삭제되지 않는다")
    void deleteAccount_wrongPassword_throwsAndDoesNotDelete() {
        // given
        given(userRepository.findByIdWithPlan(userId)).willReturn(Optional.of(user));
        given(user.getPasswordHash()).willReturn("$2a$12$hashedPassword");
        given(passwordEncoder.matches("wrong-password", "$2a$12$hashedPassword")).willReturn(false);

        // when & then
        assertThatThrownBy(() -> gdprService.deleteAccount(userId, "wrong-password"))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.USER_INVALID_PASSWORD);

        verify(userRepository, never()).deleteById(any());
        verify(eventPublisher, never()).publishEvent(any());
    }

    @Test
    @DisplayName("deleteAccount — OAuth 전용 계정(passwordHash null)은 비밀번호 검증 없이 삭제된다")
    void deleteAccount_oauthAccount_deletesWithoutPasswordCheck() {
        // given
        given(userRepository.findByIdWithPlan(userId)).willReturn(Optional.of(user));
        given(user.getPasswordHash()).willReturn(null);

        // when
        gdprService.deleteAccount(userId, null);

        // then
        verify(passwordEncoder, never()).matches(any(), any());
        verify(userRepository).deleteById(userId);
    }

    @Test
    @DisplayName("deleteAccount — 사용자가 없으면 USER_NOT_FOUND 예외가 발생한다")
    void deleteAccount_userNotFound_throwsBusinessException() {
        // given
        given(userRepository.findByIdWithPlan(userId)).willReturn(Optional.empty());

        // when & then
        assertThatThrownBy(() -> gdprService.deleteAccount(userId, "any-password"))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.USER_NOT_FOUND);
    }

    @Test
    @DisplayName("deleteAccount — audit_log 저장 실패 시에도 삭제 플로우는 계속된다")
    void deleteAccount_auditLogFails_deletionContinues() {
        // given
        given(userRepository.findByIdWithPlan(userId)).willReturn(Optional.of(user));
        given(user.getPasswordHash()).willReturn(null);
        given(auditLogRepository.save(any())).willThrow(new RuntimeException("DB error"));

        // when — 예외 없이 완료되어야 한다
        gdprService.deleteAccount(userId, null);

        // then
        verify(userRepository).deleteById(userId);
    }

    @Test
    @DisplayName("deleteAccount — userId는 AuthenticationPrincipal에서만 획득하므로 타 사용자 데이터는 삭제 불가")
    void deleteAccount_onlyDeletesOwnData_principalBound() {
        // given — 두 개의 서로 다른 userId
        UUID otherUserId = UUID.randomUUID();
        given(userRepository.findByIdWithPlan(userId)).willReturn(Optional.of(user));
        given(user.getPasswordHash()).willReturn(null);

        // when — 자신의 userId로만 삭제 요청
        gdprService.deleteAccount(userId, null);

        // then — 자신의 userId 이벤트만 발행, 타 사용자 이벤트 없음
        verify(eventPublisher).publishEvent(argThat((Object e) ->
                e instanceof GdprAccountDeletedEvent evt && evt.userId().equals(userId)));
        verify(eventPublisher, never()).publishEvent(argThat((Object e) ->
                e instanceof GdprAccountDeletedEvent evt && evt.userId().equals(otherUserId)));
        verify(userRepository).deleteById(userId);
        verify(userRepository, never()).deleteById(otherUserId);
    }
}
