package io.secureai.backend.domain.auth.dto;

import io.secureai.backend.domain.user.entity.User;
import lombok.Getter;

import java.util.UUID;

@Getter
public class LoginResponse {

    private final String accessToken;
    private final String tokenType;
    private final long expiresIn;
    private final UserInfo user;

    public LoginResponse(String accessToken, String tokenType, long expiresIn, User user) {
        this.accessToken = accessToken;
        this.tokenType = tokenType;
        this.expiresIn = expiresIn;
        this.user = new UserInfo(user);
    }

    @Getter
    public static class UserInfo {
        private final UUID id;
        private final String email;
        private final String username;
        private final String displayName;
        private final short planId;
        private final String planName;

        UserInfo(User user) {
            this.id = user.getId();
            this.email = user.getEmail();
            this.username = user.getUsername();
            this.displayName = user.getDisplayName();
            this.planId = user.getPlan().getId();
            this.planName = user.getPlan().getName();
        }
    }
}
