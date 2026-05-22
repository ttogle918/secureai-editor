package io.secureai.backend.domain.user.service;

import io.secureai.backend.domain.user.dto.GdprExportResponse;
import io.secureai.backend.domain.user.entity.User;
import io.secureai.backend.domain.user.repository.RefreshTokenRepository;
import io.secureai.backend.domain.user.repository.UserRepository;
import io.secureai.backend.global.aop.AuditLogRepository;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
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

    @InjectMocks GdprService gdprService;

    private UUID userId;
    private User user;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        // markAsDeleted() 실제 동작 검증을 위해 실제 User spy 사용
        user = spy(User.builder()
                .email("user@example.com")
                .username("testuser")
                .build());
    }

    // ── exportData ────────────────────────────────────────────────────────────

    @Test
    @DisplayName("exportData — 존재하는 사용자의 DTO가 반환된다")
    void exportData_existingUser_returnsDto() {
        // given — exportData 는 stub이 많이 필요하므로 별도 mock 사용
        User mockUser = mock(User.class);
        given(userRepository.findByIdWithPlan(userId)).willReturn(Optional.of(mockUser));
        given(mockUser.getId()).willReturn(userId);
        given(mockUser.getEmail()).willReturn("user@example.com");
        given(mockUser.getUsername()).willReturn("testuser");
        given(mockUser.getDisplayName()).willReturn("Test User");
        given(mockUser.getGithubLogin()).willReturn("gh-user");
        given(mockUser.getTimezone()).willReturn("Asia/Seoul");
        given(mockUser.getLocale()).willReturn("ko");
        given(mockUser.getPublicProfile()).willReturn(false);
        given(mockUser.getEmailVerified()).willReturn(true);
        given(mockUser.getIsActive()).willReturn(true);
        given(mockUser.getGithubId()).willReturn(12345L);
        given(mockUser.getAnthropicApiKey()).willReturn("enc-key");
        given(mockUser.getCreatedAt()).willReturn(OffsetDateTime.now().minusDays(30));
        given(mockUser.getUpdatedAt()).willReturn(OffsetDateTime.now().minusDays(1));

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
        User mockUser = mock(User.class);
        given(userRepository.findByIdWithPlan(userId)).willReturn(Optional.of(mockUser));
        given(mockUser.getId()).willReturn(userId);
        given(mockUser.getEmail()).willReturn("user@example.com");
        given(mockUser.getUsername()).willReturn("testuser");
        given(mockUser.getTimezone()).willReturn("Asia/Seoul");
        given(mockUser.getLocale()).willReturn("ko");
        given(mockUser.getPublicProfile()).willReturn(false);
        given(mockUser.getEmailVerified()).willReturn(false);
        given(mockUser.getIsActive()).willReturn(true);
        given(mockUser.getGithubId()).willReturn(null);
        given(mockUser.getAnthropicApiKey()).willReturn(null);
        given(mockUser.getCreatedAt()).willReturn(OffsetDateTime.now());
        given(mockUser.getUpdatedAt()).willReturn(OffsetDateTime.now());

        // when
        GdprExportResponse result = gdprService.exportData(userId);

        // then
        assertThat(result.isHasGithubLinked()).isFalse();
        assertThat(result.isHasByok()).isFalse();
    }

    // ── deleteAccount (소프트 삭제) ───────────────────────────────────────────

    @Test
    @DisplayName("deleteAccount — 호출 후 user.deletedAt 이 설정된다 (소프트 삭제)")
    void deleteAccount_softDelete_setsDeletedAt() {
        // given
        given(userRepository.findByIdWithPlan(userId)).willReturn(Optional.of(user));

        // when
        gdprService.deleteAccount(userId, null);

        // then — deletedAt 이 설정되어야 한다
        assertThat(user.getDeletedAt()).isNotNull();
        assertThat(user.getDeletedAt()).isBeforeOrEqualTo(OffsetDateTime.now());
    }

    @Test
    @DisplayName("deleteAccount — 호출 후 isActive 가 false 로 설정된다")
    void deleteAccount_softDelete_deactivatesUser() {
        // given
        given(userRepository.findByIdWithPlan(userId)).willReturn(Optional.of(user));

        // when
        gdprService.deleteAccount(userId, null);

        // then
        assertThat(user.getIsActive()).isFalse();
    }

    @Test
    @DisplayName("deleteAccount — 소프트 삭제 후 userRepository.deleteById 는 호출되지 않는다")
    void deleteAccount_softDelete_doesNotHardDelete() {
        // given
        given(userRepository.findByIdWithPlan(userId)).willReturn(Optional.of(user));

        // when
        gdprService.deleteAccount(userId, null);

        // then — 하드 삭제(deleteById)는 GdprHardDeleteService 책임이므로 여기서 호출되지 않아야 함
        verify(userRepository, never()).deleteById(any());
    }

    @Test
    @DisplayName("deleteAccount — 소프트 삭제 후 refresh_tokens 이 즉시 revoke 된다")
    void deleteAccount_softDelete_revokesRefreshTokens() {
        // given
        given(userRepository.findByIdWithPlan(userId)).willReturn(Optional.of(user));

        // when
        gdprService.deleteAccount(userId, null);

        // then — refresh_tokens revoke 는 소프트 삭제에서도 즉시 수행
        verify(refreshTokenRepository).revokeAllByUserId(eq(userId), any(OffsetDateTime.class), eq("gdpr_soft_delete"));
    }

    @Test
    @DisplayName("deleteAccount — 잘못된 비밀번호이면 USER_INVALID_PASSWORD 예외가 발생하고 소프트 삭제되지 않는다")
    void deleteAccount_wrongPassword_throwsAndDoesNotSoftDelete() {
        // given
        doReturn("$2a$12$hashedPassword").when(user).getPasswordHash();
        given(userRepository.findByIdWithPlan(userId)).willReturn(Optional.of(user));
        given(passwordEncoder.matches("wrong-password", "$2a$12$hashedPassword")).willReturn(false);

        // when & then
        assertThatThrownBy(() -> gdprService.deleteAccount(userId, "wrong-password"))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.USER_INVALID_PASSWORD);

        assertThat(user.getDeletedAt()).isNull();
        verify(refreshTokenRepository, never()).revokeAllByUserId(any(), any(), any());
    }

    @Test
    @DisplayName("deleteAccount — OAuth 전용 계정(passwordHash null)은 비밀번호 검증 없이 소프트 삭제된다")
    void deleteAccount_oauthAccount_softDeletesWithoutPasswordCheck() {
        // given
        given(userRepository.findByIdWithPlan(userId)).willReturn(Optional.of(user));
        // user.getPasswordHash() 는 기본 null (Builder default)

        // when
        gdprService.deleteAccount(userId, null);

        // then
        verify(passwordEncoder, never()).matches(any(), any());
        assertThat(user.getDeletedAt()).isNotNull();
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
    @DisplayName("deleteAccount — audit_log 저장 실패 시에도 소프트 삭제 플로우는 계속된다")
    void deleteAccount_auditLogFails_softDeletionContinues() {
        // given
        given(userRepository.findByIdWithPlan(userId)).willReturn(Optional.of(user));
        given(auditLogRepository.save(any())).willThrow(new RuntimeException("DB error"));

        // when — 예외 없이 완료되어야 한다
        gdprService.deleteAccount(userId, null);

        // then — 소프트 삭제는 완료되어야 함
        assertThat(user.getDeletedAt()).isNotNull();
    }
}
