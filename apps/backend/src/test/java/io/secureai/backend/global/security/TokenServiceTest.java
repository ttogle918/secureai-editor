package io.secureai.backend.global.security;

import io.jsonwebtoken.JwtException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.*;

class TokenServiceTest {

    private TokenService tokenService;

    @BeforeEach
    void setUp() {
        JwtProperties props = new JwtProperties();
        // 64-char base64 encoded 256-bit key
        props.setSecret("bXktc3VwZXItc2VjcmV0LWtleS1mb3Itand0LXNpZ25pbmctbXVzdC1iZS0yNTYtYml0cy1sb25n");
        props.setAccessTokenExpirySeconds(900);
        props.setRefreshTokenExpirySeconds(2592000);
        tokenService = new TokenService(props);
    }

    @Test
    void generateAndValidateAccessToken() {
        UUID userId = UUID.randomUUID();
        String token = tokenService.generateAccessToken(userId, "test@example.com");

        assertThat(tokenService.isValid(token)).isTrue();
        assertThat(tokenService.extractUserId(token)).isEqualTo(userId);
    }

    @Test
    void expiredToken_isInvalid() throws Exception {
        JwtProperties shortExpiry = new JwtProperties();
        shortExpiry.setSecret("bXktc3VwZXItc2VjcmV0LWtleS1mb3Itand0LXNpZ25pbmctbXVzdC1iZS0yNTYtYml0cy1sb25n");
        shortExpiry.setAccessTokenExpirySeconds(-1); // already expired
        shortExpiry.setRefreshTokenExpirySeconds(2592000);
        TokenService expiredService = new TokenService(shortExpiry);

        String token = expiredService.generateAccessToken(UUID.randomUUID(), "test@example.com");
        assertThat(expiredService.isValid(token)).isFalse();
    }

    @Test
    void tamperedToken_isInvalid() {
        String token = tokenService.generateAccessToken(UUID.randomUUID(), "test@example.com");
        String tampered = token.substring(0, token.length() - 4) + "XXXX";
        assertThat(tokenService.isValid(tampered)).isFalse();
    }

    @Test
    void generateRefreshToken_isUnique() {
        String rt1 = tokenService.generateRefreshToken();
        String rt2 = tokenService.generateRefreshToken();
        assertThat(rt1).isNotEqualTo(rt2);
        assertThat(rt1).hasSize(64);
    }

    @Test
    void generateAccessToken_containsJtiClaim() {
        UUID userId = UUID.randomUUID();
        String token = tokenService.generateAccessToken(userId, "jti@example.com");
        String jti = tokenService.extractJti(token);
        assertThat(jti).isNotNull().isNotEmpty();
    }

    @Test
    void generateAccessTokenWithJtiResult_returnsTokenAndJti() {
        UUID userId = UUID.randomUUID();
        TokenService.TokenWithJti result = tokenService.generateAccessTokenWithJtiResult(userId, "jti2@example.com");
        assertThat(result.token()).isNotNull();
        assertThat(result.jti()).isNotNull().isNotEmpty();
        assertThat(tokenService.extractJti(result.token())).isEqualTo(result.jti());
    }

    @Test
    void twoTokens_haveDifferentJti() {
        UUID userId = UUID.randomUUID();
        String t1 = tokenService.generateAccessToken(userId, "jti@example.com");
        String t2 = tokenService.generateAccessToken(userId, "jti@example.com");
        assertThat(tokenService.extractJti(t1)).isNotEqualTo(tokenService.extractJti(t2));
    }
}
