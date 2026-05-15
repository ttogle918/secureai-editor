package io.secureai.backend.domain.user.dto;

import jakarta.validation.constraints.NotNull;

/**
 * GitHub 연동 설정 변경 요청 DTO.
 * blockMergeOnCritical: Critical 취약점 발견 시 PR 머지 차단 여부
 */
public record GitHubSettingsRequest(
        @NotNull Boolean blockMergeOnCritical
) {}
