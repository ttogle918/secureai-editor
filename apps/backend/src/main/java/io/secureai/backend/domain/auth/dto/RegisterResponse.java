package io.secureai.backend.domain.auth.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.UUID;

@Getter
@AllArgsConstructor
public class RegisterResponse {
    private UUID userId;
    private String email;
    private String username;
    private String message = "이메일 인증 메일이 발송되었습니다.";

    public RegisterResponse(UUID userId, String email, String username) {
        this(userId, email, username, "이메일 인증 메일이 발송되었습니다.");
    }
}
