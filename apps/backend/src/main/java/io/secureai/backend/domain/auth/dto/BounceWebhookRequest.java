package io.secureai.backend.domain.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/**
 * 바운스/스팸 신고 웹훅 수신 DTO.
 *
 * 입력 검증은 Controller 레이어에서만 수행 (general.md 규칙).
 */
public record BounceWebhookRequest(

        @NotBlank
        @Email(message = "유효한 이메일 형식이어야 합니다.")
        String email,

        /**
         * 억제 사유: BOUNCE (수신 거부) 또는 COMPLAINT (스팸 신고).
         * 웹훅 발신자가 지정하며 대소문자 구분 없이 허용.
         */
        @NotBlank
        @Pattern(regexp = "(?i)BOUNCE|COMPLAINT", message = "reason은 BOUNCE 또는 COMPLAINT 이어야 합니다.")
        String reason
) {}
