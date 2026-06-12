package io.secureai.backend.domain.user.dto;

/**
 * GET /api/v1/users/me/provider-keys 응답.
 * 평문 키는 절대 반환하지 않는다 — hasKey 필드만 공개.
 */
public record ProviderKeyResponse(
        String provider,
        boolean hasKey,
        String defaultModel
) {}
