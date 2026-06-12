package io.secureai.backend.domain.user.controller;

import io.secureai.backend.domain.user.dto.ProviderKeyResponse;
import io.secureai.backend.domain.user.dto.SaveProviderKeyRequest;
import io.secureai.backend.domain.user.dto.ValidateKeyRequest;
import io.secureai.backend.domain.user.service.ProviderKeyService;
import io.secureai.backend.global.response.ApiResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 멀티-프로바이더 BYOK 키 API (COST-4).
 *
 * POST   /api/v1/users/me/provider-keys           — 키 저장 (upsert)
 * GET    /api/v1/users/me/provider-keys           — hasKey 목록 (평문 미반환)
 * DELETE /api/v1/users/me/provider-keys/{provider} — 키 삭제
 * POST   /api/v1/users/me/provider-keys/{provider}/validate — 경량 검증 (boolean)
 *
 * 입력 검증은 이 Controller 레이어에서만 수행 (@Valid, @Pattern).
 */
@RestController
@RequestMapping("/api/v1/users/me/provider-keys")
@RequiredArgsConstructor
@Validated
public class ProviderKeyController {

    /** provider 화이트리스트 — PathVariable/RequestBody 검증 공통 */
    private static final String PROVIDER_PATTERN = "anthropic|gemini|openai";

    private final ProviderKeyService providerKeyService;

    /** 키 저장 (upsert). AES-256-GCM 암호화는 서비스/컨버터 레이어에서 수행. */
    @PostMapping
    public ResponseEntity<ApiResponse<Map<String, String>>> saveProviderKey(
            @AuthenticationPrincipal UUID userId,
            @Valid @RequestBody SaveProviderKeyRequest request) {
        providerKeyService.saveProviderKey(userId, request);
        return ResponseEntity.ok(ApiResponse.success(Map.of("provider", request.provider(), "status", "saved")));
    }

    /**
     * provider별 hasKey 목록 반환.
     * 평문 키는 절대 포함하지 않는다.
     */
    @GetMapping
    public ResponseEntity<ApiResponse<List<ProviderKeyResponse>>> listProviderKeys(
            @AuthenticationPrincipal UUID userId) {
        return ResponseEntity.ok(ApiResponse.success(providerKeyService.listProviderKeys(userId)));
    }

    /** 키 삭제. 타 사용자 키는 서비스 레이어에서 userId로 격리. */
    @DeleteMapping("/{provider}")
    public ResponseEntity<ApiResponse<Map<String, String>>> deleteProviderKey(
            @AuthenticationPrincipal UUID userId,
            @PathVariable @Pattern(regexp = PROVIDER_PATTERN, message = "지원하지 않는 provider") String provider) {
        providerKeyService.deleteProviderKey(userId, provider);
        return ResponseEntity.ok(ApiResponse.success(Map.of("provider", provider, "status", "deleted")));
    }

    /**
     * 경량 API 키 검증 — ai_engine ping → boolean만 반환.
     * 키 값은 로그·응답 본문에 절대 포함하지 않는다.
     */
    @PostMapping("/{provider}/validate")
    public ResponseEntity<ApiResponse<Map<String, Boolean>>> validateKey(
            @AuthenticationPrincipal UUID userId,
            @PathVariable @Pattern(regexp = PROVIDER_PATTERN, message = "지원하지 않는 provider") String provider,
            @Valid @RequestBody ValidateKeyRequest request) {
        boolean valid = providerKeyService.validateKey(provider, request.apiKey());
        return ResponseEntity.ok(ApiResponse.success(Map.of("valid", valid)));
    }
}
