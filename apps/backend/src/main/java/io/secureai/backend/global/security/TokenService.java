package io.secureai.backend.global.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.util.Date;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class TokenService {

    private final JwtProperties jwtProperties;

    public record TokenWithJti(String token, String jti) {}

    public String generateAccessToken(UUID userId, String email) {
        String jti = UUID.randomUUID().toString().replace("-", "");
        return generateAccessTokenWithJti(userId, email, jti);
    }

    public TokenWithJti generateAccessTokenWithJtiResult(UUID userId, String email) {
        String jti = UUID.randomUUID().toString().replace("-", "");
        String token = generateAccessTokenWithJti(userId, email, jti);
        return new TokenWithJti(token, jti);
    }

    public String generateAccessTokenWithJti(UUID userId, String email, String jti) {
        return Jwts.builder()
                .id(jti)
                .subject(userId.toString())
                .claim("email", email)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + jwtProperties.getAccessTokenExpirySeconds() * 1000L))
                .signWith(signingKey())
                .compact();
    }

    public String extractJti(String token) {
        return parsePayload(token).getId();
    }

    public Date extractExpiration(String token) {
        return parsePayload(token).getExpiration();
    }

    public String generateRefreshToken() {
        return UUID.randomUUID().toString().replace("-", "") +
               UUID.randomUUID().toString().replace("-", "");
    }

    public boolean isValid(String token) {
        try {
            parsePayload(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            log.debug("JWT invalid: {}", e.getMessage());
            return false;
        }
    }

    public UUID extractUserId(String token) {
        return UUID.fromString(parsePayload(token).getSubject());
    }

    private Claims parsePayload(String token) {
        return Jwts.parser()
                .verifyWith(signingKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    private SecretKey signingKey() {
        return Keys.hmacShaKeyFor(Decoders.BASE64.decode(jwtProperties.getSecret()));
    }
}
