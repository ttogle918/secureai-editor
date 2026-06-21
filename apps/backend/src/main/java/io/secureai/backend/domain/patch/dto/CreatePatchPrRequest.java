package io.secureai.backend.domain.patch.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/**
 * 패치 PR 생성 요청 DTO.
 *
 * 입력 검증은 Controller 레이어에서만 수행한다 (general.md 규칙).
 * owner/repo는 GitHub 네이밍 규칙(@Pattern)으로 제한한다.
 * baseBranch는 선택 — null/blank이면 레포의 기본 브랜치를 자동 사용한다.
 */
public record CreatePatchPrRequest(

        @NotBlank(message = "owner는 필수입니다.")
        @Pattern(
                regexp = "^[a-zA-Z0-9]([a-zA-Z0-9\\-]{0,37}[a-zA-Z0-9])?$",
                message = "owner는 GitHub 사용자명 형식이어야 합니다."
        )
        String owner,

        @NotBlank(message = "repo는 필수입니다.")
        @Pattern(
                regexp = "^[a-zA-Z0-9_\\.\\-]{1,100}$",
                message = "repo는 GitHub 레포지토리 이름 형식이어야 합니다."
        )
        String repo,

        /**
         * 선택: PR의 base 브랜치. null/blank이면 레포의 기본 브랜치를 자동 사용한다.
         */
        String baseBranch
) {}
