package io.secureai.backend.domain.patch.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/**
 * AI Engine → Backend 패치 검증 결과 보고 DTO.
 *
 * 입력 검증은 Controller 레이어에서만 수행한다 (general.md 보안 규칙).
 * status 값은 DB CHECK 제약과 동일하게 VERIFIED / FAILED 만 허용한다
 * (PENDING은 초기 상태이므로 보고 대상이 아님).
 *
 * @param status VERIFIED 또는 FAILED
 * @param log    검증 실행 로그 요약 (선택 — 민감 페이로드 금지)
 */
public record PatchVerificationRequest(

    @NotBlank
    @Pattern(
        regexp = "^(VERIFIED|FAILED)$",
        message = "status 는 VERIFIED 또는 FAILED 이어야 합니다."
    )
    String status,

    /** 실행 로그 요약 (null 허용). 민감 토큰·페이로드 포함 금지. */
    String log
) {}
