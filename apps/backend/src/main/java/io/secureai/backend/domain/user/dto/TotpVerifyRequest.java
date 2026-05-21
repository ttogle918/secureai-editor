package io.secureai.backend.domain.user.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * TOTP 코드 또는 복구 코드 검증 요청.
 */
public record TotpVerifyRequest(@NotBlank String code) {}
