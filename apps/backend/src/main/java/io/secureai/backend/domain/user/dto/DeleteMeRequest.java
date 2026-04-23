package io.secureai.backend.domain.user.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;

@Getter
public class DeleteMeRequest {

    @NotBlank
    private String confirmPassword;

    private String reason;
}
