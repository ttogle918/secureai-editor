package io.secureai.backend.domain.analysis.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * 트리아지 PATCH 요청 DTO.
 *
 * <p>입력 검증은 이 클래스(Controller 레이어)에서만 수행한다.
 * reason 은 민감정보를 포함할 수 있으므로 로그에 절대 포함하지 않는다.
 *
 * @param action CONFIRM | DISMISS | ACCEPT_PATCH (화이트리스트)
 * @param reason 선택적 사유 (최대 1000자)
 */
public record TriageRequest(

        @NotBlank(message = "action은 필수입니다.")
        @Pattern(
                regexp = "^(CONFIRM|DISMISS|ACCEPT_PATCH)$",
                message = "action은 CONFIRM, DISMISS, ACCEPT_PATCH 중 하나여야 합니다."
        )
        String action,

        @Size(max = 1000, message = "reason은 1000자를 초과할 수 없습니다.")
        String reason
) {}
