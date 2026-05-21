package io.secureai.backend.domain.user.dto;

import java.util.List;

/**
 * TOTP 활성화 검증 응답.
 * success      — 검증 및 활성화 성공 여부.
 * recoveryCodes — 최초 활성화 시에만 반환 (이후 재조회 불가).
 */
public record TotpVerifyResponse(boolean success, List<String> recoveryCodes) {}
