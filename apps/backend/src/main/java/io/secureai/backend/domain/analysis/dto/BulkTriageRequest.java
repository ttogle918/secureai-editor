package io.secureai.backend.domain.analysis.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

/**
 * 벌크 트리아지 PATCH 요청 DTO — 여러 취약점에 같은 action(+reason)을 한 번에 적용한다.
 *
 * <p>입력 검증은 이 클래스(Controller 레이어)에서만 수행한다.
 * reason 은 민감정보를 포함할 수 있으므로 로그에 절대 포함하지 않는다.
 *
 * @param vulnIds 트리아지 대상 취약점 ID 목록 (1~{@value #MAX_BATCH}건)
 * @param action  CONFIRM | DISMISS | ACCEPT_PATCH (화이트리스트)
 * @param reason  선택적 사유 (최대 1000자)
 */
public record BulkTriageRequest(

        @NotEmpty(message = "vulnIds는 비어 있을 수 없습니다.")
        @Size(max = MAX_BATCH, message = "한 번에 최대 " + MAX_BATCH + "건까지 처리할 수 있습니다.")
        List<@NotNull(message = "vulnId는 null일 수 없습니다.") UUID> vulnIds,

        @NotBlank(message = "action은 필수입니다.")
        @Pattern(
                regexp = "^(CONFIRM|DISMISS|ACCEPT_PATCH)$",
                message = "action은 CONFIRM, DISMISS, ACCEPT_PATCH 중 하나여야 합니다."
        )
        String action,

        @Size(max = 1000, message = "reason은 1000자를 초과할 수 없습니다.")
        String reason
) {
    /** 단일 요청 배치 상한 — 과도한 페이로드/메모리 사용 방지 */
    public static final int MAX_BATCH = 200;
}
