package io.secureai.backend.domain.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/**
 * 워크스페이스 모드 변경 요청 DTO.
 * 허용 값: DEVELOPER, SECURITY_MANAGER, BOTH — Controller @Pattern 에서 단일 검증.
 */
public record UpdateWorkspaceModeRequest(
        @NotBlank
        @Pattern(regexp = "^(DEVELOPER|SECURITY_MANAGER|BOTH)$",
                 message = "workspaceMode 는 DEVELOPER, SECURITY_MANAGER, BOTH 중 하나여야 합니다.")
        String workspaceMode
) {}
