package io.secureai.backend.domain.user.service;

import io.secureai.backend.domain.plan.Plan;
import io.secureai.backend.domain.user.dto.UpdateSettingsRequest;
import io.secureai.backend.domain.user.dto.UserMeResponse;
import io.secureai.backend.domain.user.entity.User;
import io.secureai.backend.domain.user.repository.RefreshTokenRepository;
import io.secureai.backend.domain.user.repository.UserRepository;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import io.secureai.backend.global.model.ModelConstants;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock UserRepository userRepository;
    @Mock RefreshTokenRepository refreshTokenRepository;
    @Mock PasswordEncoder passwordEncoder;
    @Mock RedisTemplate<String, String> redisTemplate;

    @InjectMocks UserService userService;

    private UUID userId;
    private User user;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        user   = mock(User.class);
    }

    // ── findOrThrow ───────────────────────────────────────────────────────────

    @Test
    @DisplayName("findOrThrow — 사용자가 존재하면 User를 반환한다")
    void findOrThrow_found_returnsUser() {
        when(userRepository.findByIdWithPlan(userId)).thenReturn(Optional.of(user));

        User result = userService.findOrThrow(userId);

        assertThat(result).isSameAs(user);
    }

    @Test
    @DisplayName("findOrThrow — 사용자가 없으면 USER_NOT_FOUND 예외가 발생한다")
    void findOrThrow_notFound_throwsUserNotFound() {
        when(userRepository.findByIdWithPlan(userId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.findOrThrow(userId))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.USER_NOT_FOUND);
    }

    // ── findAllByIds ──────────────────────────────────────────────────────────

    @Test
    @DisplayName("findAllByIds — ID 목록으로 User 목록을 반환한다")
    void findAllByIds_returnsUserList() {
        List<UUID> ids = List.of(userId, UUID.randomUUID());
        when(userRepository.findAllById(ids)).thenReturn(List.of(user));

        List<User> result = userService.findAllByIds(ids);

        assertThat(result).containsExactly(user);
    }

    // ── getDecryptedGithubToken ───────────────────────────────────────────────

    @Test
    @DisplayName("getDecryptedGithubToken — 사용자가 없으면 USER_NOT_FOUND 예외가 발생한다")
    void getDecryptedGithubToken_notFound_throwsUserNotFound() {
        when(userRepository.findById(userId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.getDecryptedGithubToken(userId))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.USER_NOT_FOUND);
    }

    // ── updateSettings — 모델→provider 자동 유도 ─────────────────────────────

    private Plan buildMockPlan() {
        // CreditSummaryResponse.from(user) 는 Plan 필드를 사용하지 않으므로
        // 불필요한 stubbing 없이 bare mock만 반환한다.
        return mock(Plan.class);
    }

    @Test
    @DisplayName("updateSettings — claude 모델 선택 시 preferredProvider가 anthropic으로 자동 설정된다")
    void updateSettings_claudeModel_setsProviderAnthropic() {
        User realUser = User.builder()
                .email("a@b.com").username("dev").plan(buildMockPlan())
                .preferredModel(ModelConstants.HAIKU)
                .preferredProvider("anthropic")
                .build();
        when(userRepository.findByIdWithPlan(userId)).thenReturn(Optional.of(realUser));

        userService.updateSettings(userId, new UpdateSettingsRequest(ModelConstants.SONNET, null));

        assertThat(realUser.getPreferredModel()).isEqualTo(ModelConstants.SONNET);
        assertThat(realUser.getPreferredProvider()).isEqualTo("anthropic");
        verify(userRepository).save(realUser);
    }

    @Test
    @DisplayName("updateSettings — gemini 모델 선택 시 preferredProvider가 gemini로 자동 설정된다")
    void updateSettings_geminiModel_setsProviderGemini() {
        User realUser = User.builder()
                .email("a@b.com").username("dev").plan(buildMockPlan())
                .preferredModel(ModelConstants.HAIKU)
                .preferredProvider("anthropic")
                .build();
        when(userRepository.findByIdWithPlan(userId)).thenReturn(Optional.of(realUser));

        userService.updateSettings(userId, new UpdateSettingsRequest(ModelConstants.GEMINI_FLASH, null));

        assertThat(realUser.getPreferredModel()).isEqualTo(ModelConstants.GEMINI_FLASH);
        assertThat(realUser.getPreferredProvider()).isEqualTo("gemini");
        verify(userRepository).save(realUser);
    }

    @Test
    @DisplayName("updateSettings — gpt 모델 선택 시 preferredProvider가 openai로 자동 설정된다")
    void updateSettings_gptModel_setsProviderOpenai() {
        User realUser = User.builder()
                .email("a@b.com").username("dev").plan(buildMockPlan())
                .preferredModel(ModelConstants.HAIKU)
                .preferredProvider("anthropic")
                .build();
        when(userRepository.findByIdWithPlan(userId)).thenReturn(Optional.of(realUser));

        userService.updateSettings(userId, new UpdateSettingsRequest(ModelConstants.GPT4O, null));

        assertThat(realUser.getPreferredModel()).isEqualTo(ModelConstants.GPT4O);
        assertThat(realUser.getPreferredProvider()).isEqualTo("openai");
        verify(userRepository).save(realUser);
    }

    @Test
    @DisplayName("updateSettings — 미지원 모델은 IllegalArgumentException을 던진다")
    void updateSettings_invalidModel_throwsException() {
        // request.validate() 는 loadUser 전에 실행되므로 repository stub 불필요
        assertThatThrownBy(() ->
                userService.updateSettings(userId, new UpdateSettingsRequest("invalid-model-xyz", null))
        ).isInstanceOf(IllegalArgumentException.class);
    }

    // ── updateWorkspaceMode (TASK-1101) ───────────────────────────────────────

    @Test
    @DisplayName("updateWorkspaceMode — 모드를 저장하고 갱신된 응답을 반환한다")
    void updateWorkspaceMode_savesAndReturns() {
        Plan plan = mock(Plan.class);
        when(plan.getMonthlySastLimit()).thenReturn(50);
        when(plan.getId()).thenReturn((short) 1);
        when(plan.getAllowDast()).thenReturn(false);
        when(plan.getAllowMonitoring()).thenReturn(false);

        User realUser = User.builder()
                .email("a@b.com").username("dev").plan(plan)
                .workspaceMode("DEVELOPER")
                .build();
        when(userRepository.findByIdWithPlan(userId)).thenReturn(Optional.of(realUser));

        UserMeResponse res = userService.updateWorkspaceMode(userId, "SECURITY_MANAGER");

        assertThat(realUser.getWorkspaceMode()).isEqualTo("SECURITY_MANAGER");
        assertThat(res.getWorkspaceMode()).isEqualTo("SECURITY_MANAGER");
        verify(userRepository).save(realUser);
    }
}
