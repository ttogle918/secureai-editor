package io.secureai.backend.domain.dast.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

/**
 * Frontend → Backend 배치 DAST 시작 요청 DTO.
 * 도메인 소유권과 consentGiven 은 배치 전체에 공유된다.
 * targets 의 각 항목에는 @Valid 로 중첩 검증을 적용한다.
 */
public record DastBatchRequest(
        @NotNull UUID sessionId,
        @NotBlank String domain,
        boolean consentGiven,
        @NotEmpty
        @Size(max = 50, message = "targets 는 최대 50개까지 허용됩니다.")
        @Valid
        List<DastBatchTarget> targets
) {}
