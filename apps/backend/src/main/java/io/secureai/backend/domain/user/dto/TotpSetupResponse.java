package io.secureai.backend.domain.user.dto;

import java.util.List;

/**
 * TOTP 설정 초기화 응답.
 * qrCodeUrl — Google Authenticator 등에서 스캔할 QR 이미지 URL (data URI).
 * secret     — 수동 입력용 Base32 비밀 키.
 * recoveryCodes — 일회성 복구 코드 8개 (원문, 이후 재조회 불가).
 */
public record TotpSetupResponse(String qrCodeUrl, String secret, List<String> recoveryCodes) {}
