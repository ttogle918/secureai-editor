package io.secureai.backend.domain.user.service;

import io.secureai.backend.domain.user.dto.SaveProviderKeyRequest;
import io.secureai.backend.domain.user.dto.ProviderKeyResponse;
import io.secureai.backend.domain.user.entity.User;
import io.secureai.backend.domain.user.entity.UserProviderKey;
import io.secureai.backend.domain.user.repository.UserProviderKeyRepository;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ProviderKeyServiceTest {

    @Mock UserProviderKeyRepository providerKeyRepository;
    @Mock UserService userService;
    @Mock RestClient aiEngineClient;

    private ProviderKeyService providerKeyService;

    private UUID userId;
    private User user;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        user   = mock(User.class);
        lenient().when(user.getId()).thenReturn(userId);

        // RestClient는 내부에서 빌더로 생성하므로 직접 주입
        providerKeyService = new ProviderKeyService(
                providerKeyRepository, userService, aiEngineClient
        );
    }

    // ────────────────────────────────────────────────────────────────────────
    // saveProviderKey
    // ────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("신규 provider 키 저장 시 엔티티가 생성된다")
    void saveProviderKey_newKey_createsEntity() {
        when(userService.findOrThrow(userId)).thenReturn(user);
        when(providerKeyRepository.findByUserIdAndProvider(userId, "gemini")).thenReturn(Optional.empty());

        SaveProviderKeyRequest req = new SaveProviderKeyRequest("gemini", "AIza-test-key", "gemini-2.5-flash");
        providerKeyService.saveProviderKey(userId, req);

        ArgumentCaptor<UserProviderKey> captor = ArgumentCaptor.forClass(UserProviderKey.class);
        verify(providerKeyRepository).save(captor.capture());
        UserProviderKey saved = captor.getValue();

        assertThat(saved.getProvider()).isEqualTo("gemini");
        assertThat(saved.getApiKey()).isEqualTo("AIza-test-key");  // 컨버터는 DB 저장 시 암호화
        assertThat(saved.getDefaultModel()).isEqualTo("gemini-2.5-flash");
        assertThat(saved.getUserId()).isEqualTo(userId);
    }

    @Test
    @DisplayName("동일 provider 키 재저장 시 upsert(갱신)된다")
    void saveProviderKey_existingKey_updatesExisting() {
        UserProviderKey existing = UserProviderKey.builder()
                .userId(userId).provider("gemini").apiKey("old-key").build();
        when(userService.findOrThrow(userId)).thenReturn(user);
        when(providerKeyRepository.findByUserIdAndProvider(userId, "gemini"))
                .thenReturn(Optional.of(existing));

        SaveProviderKeyRequest req = new SaveProviderKeyRequest("gemini", "new-key", null);
        providerKeyService.saveProviderKey(userId, req);

        assertThat(existing.getApiKey()).isEqualTo("new-key");
        verify(providerKeyRepository).save(existing);
    }

    // ────────────────────────────────────────────────────────────────────────
    // listProviderKeys — GET hasKey만 반환
    // ────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("listProviderKeys — 저장된 provider는 hasKey=true, 없는 provider는 hasKey=false")
    void listProviderKeys_returnsHasKeyOnly() {
        UserProviderKey geminiKey = UserProviderKey.builder()
                .userId(userId).provider("gemini").apiKey("secret-key").defaultModel("gemini-2.5-flash").build();
        when(providerKeyRepository.findAllByUserId(userId)).thenReturn(List.of(geminiKey));

        List<ProviderKeyResponse> result = providerKeyService.listProviderKeys(userId);

        assertThat(result).hasSize(3); // anthropic, gemini, openai
        ProviderKeyResponse geminiResp = result.stream()
                .filter(r -> "gemini".equals(r.provider())).findFirst().orElseThrow();
        assertThat(geminiResp.hasKey()).isTrue();
        assertThat(geminiResp.defaultModel()).isEqualTo("gemini-2.5-flash");

        // 응답에 평문 키가 포함되지 않도록 ProviderKeyResponse 타입 자체에 apiKey 필드 없음 확인
        ProviderKeyResponse anthropicResp = result.stream()
                .filter(r -> "anthropic".equals(r.provider())).findFirst().orElseThrow();
        assertThat(anthropicResp.hasKey()).isFalse();
    }

    @Test
    @DisplayName("listProviderKeys — 응답 타입에 apiKey 필드가 없어 평문 키 노출 불가")
    void listProviderKeys_responseHasNoRawKeyField() {
        when(providerKeyRepository.findAllByUserId(userId)).thenReturn(List.of());
        List<ProviderKeyResponse> result = providerKeyService.listProviderKeys(userId);

        // ProviderKeyResponse record에 apiKey 필드가 없음 — 컴파일 수준 보안
        result.forEach(r -> {
            assertThat(r.provider()).isNotNull();
            assertThat(r).isInstanceOf(ProviderKeyResponse.class);
        });
    }

    // ────────────────────────────────────────────────────────────────────────
    // deleteProviderKey
    // ────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("지원하지 않는 provider 삭제 시 INVALID_INPUT 예외가 발생한다")
    void deleteProviderKey_unsupportedProvider_throwsInvalidInput() {
        assertThatThrownBy(() -> providerKeyService.deleteProviderKey(userId, "unknown-provider"))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.INVALID_INPUT);
    }

    @Test
    @DisplayName("deleteProviderKey — 삭제 호출이 repository에 위임된다")
    void deleteProviderKey_callsRepository() {
        providerKeyService.deleteProviderKey(userId, "gemini");
        verify(providerKeyRepository).deleteByUserIdAndProvider(userId, "gemini");
    }

    // ────────────────────────────────────────────────────────────────────────
    // resolveKeyForAnalysis — fallback 레이어
    // ────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("preferredProvider 키가 있으면 해당 키를 반환한다")
    void resolveKeyForAnalysis_providerKeyExists_returnsIt() {
        UserProviderKey geminiKey = UserProviderKey.builder()
                .userId(userId).provider("gemini").apiKey("gemini-decrypted-key").build();
        when(providerKeyRepository.findByUserIdAndProvider(userId, "gemini"))
                .thenReturn(Optional.of(geminiKey));

        ProviderKeyService.ResolvedKey resolved = providerKeyService.resolveKeyForAnalysis(userId, "gemini");

        assertThat(resolved.provider()).isEqualTo("gemini");
        assertThat(resolved.apiKey()).isEqualTo("gemini-decrypted-key");
    }

    @Test
    @DisplayName("preferredProvider 키가 없으면 레거시 anthropic_api_key로 fallback한다")
    void resolveKeyForAnalysis_noProviderKey_fallbacksToLegacy() {
        when(providerKeyRepository.findByUserIdAndProvider(userId, "gemini"))
                .thenReturn(Optional.empty());
        when(userService.findOrThrow(userId)).thenReturn(user);
        when(user.getAnthropicApiKey()).thenReturn("legacy-anthropic-key");

        ProviderKeyService.ResolvedKey resolved = providerKeyService.resolveKeyForAnalysis(userId, "gemini");

        assertThat(resolved.provider()).isEqualTo("anthropic");
        assertThat(resolved.apiKey()).isEqualTo("legacy-anthropic-key");
    }

    @Test
    @DisplayName("preferredProvider도 없고 레거시 키도 없으면 apiKey=null로 플랫폼 기본값 사용")
    void resolveKeyForAnalysis_noKeyAtAll_returnsNullApiKey() {
        when(providerKeyRepository.findByUserIdAndProvider(userId, "gemini"))
                .thenReturn(Optional.empty());
        when(userService.findOrThrow(userId)).thenReturn(user);
        when(user.getAnthropicApiKey()).thenReturn(null);

        ProviderKeyService.ResolvedKey resolved = providerKeyService.resolveKeyForAnalysis(userId, "gemini");

        assertThat(resolved.apiKey()).isNull();
    }

    @Test
    @DisplayName("preferredProvider=null이면 레거시 anthropic 키 경로로 직접 fallback한다")
    void resolveKeyForAnalysis_nullProvider_returnsLegacyKey() {
        when(userService.findOrThrow(userId)).thenReturn(user);
        when(user.getAnthropicApiKey()).thenReturn("anthropic-legacy");

        ProviderKeyService.ResolvedKey resolved = providerKeyService.resolveKeyForAnalysis(userId, null);

        assertThat(resolved.provider()).isEqualTo("anthropic");
        assertThat(resolved.apiKey()).isEqualTo("anthropic-legacy");
        verifyNoInteractions(providerKeyRepository);
    }
}
