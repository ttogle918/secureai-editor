package io.secureai.backend.domain.user.dto;

// confirmPassword: 비밀번호 계정은 필수, OAuth 전용 계정(passwordHash == null)은 null 허용
public record GdprDeleteRequest(
        String confirmPassword
) {}
