package io.secureai.backend.domain.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;

@Getter
public class RegisterRequest {

    @NotBlank
    @Email(message = "올바른 이메일 형식이 아닙니다.")
    private String email;

    @NotBlank
    @Size(min = 8, max = 100, message = "비밀번호는 8자 이상 100자 이하여야 합니다.")
    @Pattern(regexp = "^(?=.*[A-Z])(?=.*[a-z])(?=.*\\d).*$",
             message = "비밀번호는 대소문자와 숫자를 포함해야 합니다.")
    private String password;

    @NotBlank
    @Size(min = 3, max = 100, message = "사용자명은 3자 이상 100자 이하여야 합니다.")
    @Pattern(regexp = "^[a-zA-Z0-9_.-]+$", message = "사용자명은 영문, 숫자, _.-만 사용 가능합니다.")
    private String username;

    @Size(max = 100)
    private String displayName;
}
