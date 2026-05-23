package io.secureai.backend.domain.notification;

import io.secureai.backend.domain.notification.entity.DeviceToken;
import io.secureai.backend.domain.notification.repository.DeviceTokenRepository;
import io.secureai.backend.domain.notification.service.DeviceTokenService;
import io.secureai.backend.domain.plan.Plan;
import io.secureai.backend.domain.user.entity.User;
import io.secureai.backend.domain.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DeviceTokenServiceTest {

    @Mock DeviceTokenRepository deviceTokenRepository;
    @Mock UserRepository userRepository;

    @InjectMocks DeviceTokenService deviceTokenService;

    private UUID userId;
    private User user;
    private static final String SAMPLE_TOKEN = "fcm-token-sample";

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        user = User.builder()
                .email("test@example.com")
                .username("tester")
                .emailVerified(true)
                .plan(new Plan())
                .build();
        ReflectionTestUtils.setField(user, "id", userId);
    }

    @Test
    @DisplayName("registerToken: 중복 토큰 등록 시 저장하지 않고 무시한다")
    void registerToken_ignoresDuplicate_whenTokenAlreadyExists() {
        when(deviceTokenRepository.existsByUserIdAndToken(userId, SAMPLE_TOKEN)).thenReturn(true);

        deviceTokenService.registerToken(userId, SAMPLE_TOKEN);

        verify(deviceTokenRepository, never()).save(any());
        verify(userRepository, never()).findById(any());
    }

    @Test
    @DisplayName("registerToken: 신규 토큰은 저장한다")
    void registerToken_saves_whenTokenIsNew() {
        when(deviceTokenRepository.existsByUserIdAndToken(userId, SAMPLE_TOKEN)).thenReturn(false);
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(deviceTokenRepository.save(any(DeviceToken.class))).thenAnswer(i -> i.getArgument(0));

        deviceTokenService.registerToken(userId, SAMPLE_TOKEN);

        verify(deviceTokenRepository).save(any(DeviceToken.class));
    }

    @Test
    @DisplayName("removeToken: 해당 사용자의 토큰을 삭제한다")
    void removeToken_deletesToken_forGivenUserId() {
        deviceTokenService.removeToken(userId, SAMPLE_TOKEN);

        verify(deviceTokenRepository).deleteByUserIdAndToken(userId, SAMPLE_TOKEN);
    }

    @Test
    @DisplayName("findTokensByUserId: 등록된 토큰 문자열 목록을 반환한다")
    void findTokensByUserId_returnsTokenStrings() {
        DeviceToken dt1 = DeviceToken.builder().user(user).token("token-1").build();
        DeviceToken dt2 = DeviceToken.builder().user(user).token("token-2").build();
        when(deviceTokenRepository.findByUserId(userId)).thenReturn(List.of(dt1, dt2));

        List<String> tokens = deviceTokenService.findTokensByUserId(userId);

        assertThat(tokens).containsExactly("token-1", "token-2");
    }

    @Test
    @DisplayName("findTokensByUserId: 등록된 토큰이 없으면 빈 목록을 반환한다")
    void findTokensByUserId_returnsEmpty_whenNoTokens() {
        when(deviceTokenRepository.findByUserId(userId)).thenReturn(List.of());

        List<String> tokens = deviceTokenService.findTokensByUserId(userId);

        assertThat(tokens).isEmpty();
    }
}
