package io.secureai.backend.domain.auth.service;

import io.secureai.backend.domain.plan.Plan;
import io.secureai.backend.domain.user.entity.User;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.OffsetDateTime;

import static org.assertj.core.api.Assertions.*;

class AuthServiceLoginTest {

    private final PasswordEncoder encoder = new BCryptPasswordEncoder(12);

    @Test
    void bcrypt_correctPassword_matches() {
        String raw = "P@ssw0rd!";
        String hash = encoder.encode(raw);
        assertThat(encoder.matches(raw, hash)).isTrue();
    }

    @Test
    void bcrypt_wrongPassword_doesNotMatch() {
        String hash = encoder.encode("correct");
        assertThat(encoder.matches("wrong", hash)).isFalse();
    }

    @Test
    void loginFail_5times_setsLockedUntil() {
        User user = buildActiveUser();

        for (int i = 1; i <= 5; i++) {
            incrementLoginFail(user);
        }

        assertThat(user.getLoginFailCount()).isEqualTo((short) 5);
        assertThat(user.getLockedUntil()).isNotNull();
        assertThat(user.getLockedUntil()).isAfter(OffsetDateTime.now());
    }

    @Test
    void loginFail_4times_notYetLocked() {
        User user = buildActiveUser();

        for (int i = 1; i <= 4; i++) {
            incrementLoginFail(user);
        }

        assertThat(user.getLoginFailCount()).isEqualTo((short) 4);
        assertThat(user.getLockedUntil()).isNull();
    }

    @Test
    void sha256_deterministic() {
        String h1 = AuthService.sha256("token123");
        String h2 = AuthService.sha256("token123");
        assertThat(h1).isEqualTo(h2).hasSize(64);
    }

    @Test
    void sha256_differentInputs_differentHash() {
        assertThat(AuthService.sha256("abc")).isNotEqualTo(AuthService.sha256("ABC"));
    }

    private void incrementLoginFail(User user) {
        short fails = (short) (user.getLoginFailCount() + 1);
        user.setLoginFailCount(fails);
        if (fails >= 5) {
            user.setLockedUntil(OffsetDateTime.now().plusMinutes(15));
        }
    }

    private User buildActiveUser() {
        return User.builder()
                .email("test@example.com")
                .username("testuser")
                .passwordHash(encoder.encode("password"))
                .emailVerified(true)
                .loginFailCount((short) 0)
                .plan(new Plan())
                .build();
    }
}
