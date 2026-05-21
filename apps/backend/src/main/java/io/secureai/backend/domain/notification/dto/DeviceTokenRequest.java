package io.secureai.backend.domain.notification.dto;

import jakarta.validation.constraints.NotBlank;

public record DeviceTokenRequest(
        @NotBlank(message = "token must not be blank")
        String token
) {}
