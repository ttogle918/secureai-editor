package io.secureai.backend.domain.user.dto;

import jakarta.validation.constraints.Size;
import lombok.Getter;

@Getter
public class UpdateUserRequest {

    @Size(max = 100)
    private String displayName;

    @Size(max = 50)
    private String timezone;

    @Size(max = 10)
    private String locale;
}
