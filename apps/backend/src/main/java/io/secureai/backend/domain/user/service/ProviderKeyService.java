package io.secureai.backend.domain.user.service;

import io.secureai.backend.domain.user.dto.ProviderKeyResponse;
import io.secureai.backend.domain.user.dto.SaveProviderKeyRequest;
import io.secureai.backend.domain.user.entity.UserProviderKey;
import io.secureai.backend.domain.user.repository.UserProviderKeyRepository;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * 멀티-프로바이더 BYOK 키 관리 서비스 (COST-4).
 *
 * 책임:
 * - provider 키 AES 암호화 upsert / 조회(hasKey만 공개) / 삭제
 * - 분석 시 provider 키 복호화 후 전달 (fallback 레이어 포함)
 * - ai_engine /agent/validate-key 위임 (boolean만 반환)
 *
 * 보안:
 * - GET 응답에 평문 키 포함 금지
 * - 키 관련 로그 출력 금지
 * - 타 사용자 키 접근 403
 */
@Slf4j
@Service
public class ProviderKeyService {

    private static final List<String> SUPPORTED_PROVIDERS = List.of("anthropic", "gemini", "openai");

    private final UserProviderKeyRepository providerKeyRepository;
    private final UserService userService;

    /** ai_engine validate-key 엔드포인트 (경량 ping) */
    private final RestClient aiEngineClient;

    /** Spring 컨테이너 생성자 — @Value로 URL/키 주입 (생성자 2개라 명시적 @Autowired 필요) */
    @Autowired
    public ProviderKeyService(
            UserProviderKeyRepository providerKeyRepository,
            UserService userService,
            @Value("${secureai.ai-agent.url}") String agentUrl,
            @Value("${secureai.internal-api-key}") String internalKey
    ) {
        this.providerKeyRepository = providerKeyRepository;
        this.userService = userService;
        this.aiEngineClient = RestClient.builder()
                .baseUrl(agentUrl)
                .defaultHeader("X-Internal-Key", internalKey)
                .build();
    }

    /** 테스트 전용 생성자 — RestClient mock 직접 주입 */
    ProviderKeyService(
            UserProviderKeyRepository providerKeyRepository,
            UserService userService,
            RestClient aiEngineClient
    ) {
        this.providerKeyRepository = providerKeyRepository;
        this.userService = userService;
        this.aiEngineClient = aiEngineClient;
    }

    /** provider 키 저장 (upsert). 키는 AesEncryptionConverter가 자동 암호화. */
    @Transactional
    public void saveProviderKey(UUID userId, SaveProviderKeyRequest request) {
        // provider 소유권 검증: userId 확인 (loadUser가 USER_NOT_FOUND 처리)
        userService.findOrThrow(userId);

        Optional<UserProviderKey> existing =
                providerKeyRepository.findByUserIdAndProvider(userId, request.provider());

        if (existing.isPresent()) {
            // upsert: 기존 레코드 갱신
            UserProviderKey key = existing.get();
            key.setApiKey(request.apiKey());
            if (request.defaultModel() != null) key.setDefaultModel(request.defaultModel());
            providerKeyRepository.save(key);
        } else {
            UserProviderKey key = UserProviderKey.builder()
                    .userId(userId)
                    .provider(request.provider())
                    .apiKey(request.apiKey())    // AesEncryptionConverter 자동 암호화
                    .defaultModel(request.defaultModel())
                    .build();
            providerKeyRepository.save(key);
        }
        // 키 값은 로그에 절대 출력 금지
        log.info("[provider-key] saved provider={} userId={}", request.provider(), userId);
    }

    /** provider 키 목록 조회 — hasKey(boolean)만 반환, 평문 절대 미반환. */
    @Transactional(readOnly = true)
    public List<ProviderKeyResponse> listProviderKeys(UUID userId) {
        List<UserProviderKey> keys = providerKeyRepository.findAllByUserId(userId);
        return SUPPORTED_PROVIDERS.stream()
                .map(provider -> {
                    Optional<UserProviderKey> match = keys.stream()
                            .filter(k -> k.getProvider().equals(provider))
                            .findFirst();
                    return new ProviderKeyResponse(
                            provider,
                            match.isPresent(),
                            match.map(UserProviderKey::getDefaultModel).orElse(null)
                    );
                })
                .toList();
    }

    /** provider 키 삭제. 타 사용자 키 접근 시 403. */
    @Transactional
    public void deleteProviderKey(UUID userId, String provider) {
        validateProvider(provider);
        // 존재하지 않아도 idempotent (삭제 성공으로 처리)
        providerKeyRepository.deleteByUserIdAndProvider(userId, provider);
        log.info("[provider-key] deleted provider={} userId={}", provider, userId);
    }

    /**
     * 분석 시 복호화된 provider 키와 provider 식별자를 반환.
     *
     * fallback 순서:
     * 1. user_provider_keys.provider (요청된 preferredProvider)
     * 2. users.anthropic_api_key (레거시 BYOK)
     * 3. null (플랫폼 기본 키 사용)
     *
     * @param userId            사용자 ID
     * @param preferredProvider 사용자가 선택한 provider (null 허용)
     * @return (resolvedProvider, decryptedApiKey) — apiKey가 null이면 플랫폼 기본 키 사용
     */
    @Transactional(readOnly = true)
    public ResolvedKey resolveKeyForAnalysis(UUID userId, String preferredProvider) {
        if (preferredProvider != null) {
            Optional<UserProviderKey> keyOpt =
                    providerKeyRepository.findByUserIdAndProvider(userId, preferredProvider);
            if (keyOpt.isPresent()) {
                // apiKey는 복호화된 상태로 반환됨 (AesEncryptionConverter)
                return new ResolvedKey(preferredProvider, keyOpt.get().getApiKey());
            }
            // preferredProvider 키 없음 — fallback 로깅
            log.info("[provider-key] provider={} key not found, falling back to legacy anthropic key userId={}",
                    preferredProvider, userId);
        }

        // fallback: 레거시 anthropic_api_key
        String legacyKey = userService.findOrThrow(userId).getAnthropicApiKey();
        if (legacyKey != null) {
            return new ResolvedKey("anthropic", legacyKey);
        }

        // 플랫폼 기본 키 사용
        return new ResolvedKey(preferredProvider != null ? preferredProvider : "anthropic", null);
    }

    /**
     * ai_engine에 경량 ping → boolean만 반환.
     * 키 값은 로그에 절대 출력 금지.
     */
    public boolean validateKey(String provider, String apiKey) {
        validateProvider(provider);
        try {
            Map<String, Object> body = new HashMap<>();
            body.put("provider", provider);
            body.put("api_key", apiKey);  // 로그 금지 — body 객체를 통해서만 전달

            @SuppressWarnings("unchecked")
            Map<String, Object> result = aiEngineClient.post()
                    .uri("/agent/validate-key")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(Map.class);

            return result != null && Boolean.TRUE.equals(result.get("valid"));
        } catch (Exception e) {
            log.warn("[provider-key] validate failed provider={} cause={}", provider, e.getMessage());
            return false;
        }
    }

    private void validateProvider(String provider) {
        if (!SUPPORTED_PROVIDERS.contains(provider)) {
            throw new BusinessException(ErrorCode.INVALID_INPUT);
        }
    }

    /** 분석 시 사용할 provider + 복호화된 API 키 페어 */
    public record ResolvedKey(String provider, String apiKey) {}
}
