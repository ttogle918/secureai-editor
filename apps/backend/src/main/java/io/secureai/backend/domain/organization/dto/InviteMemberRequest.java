package io.secureai.backend.domain.organization.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

public record InviteMemberRequest(
        @Email
        @NotBlank
        String email,

        @NotNull
        @Pattern(regexp = "^(admin|member)$",
                message = "역할은 admin 또는 member만 허용됩니다.")
        String role
) {
}
