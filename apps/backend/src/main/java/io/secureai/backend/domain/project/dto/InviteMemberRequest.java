package io.secureai.backend.domain.project.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Getter;

@Getter
public class InviteMemberRequest {

    @NotBlank
    @Email
    private String email;

    @NotBlank
    @Pattern(regexp = "^(admin|viewer)$", message = "role은 admin 또는 viewer여야 합니다.")
    private String role;
}
