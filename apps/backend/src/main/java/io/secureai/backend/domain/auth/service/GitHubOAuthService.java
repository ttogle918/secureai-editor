package io.secureai.backend.domain.auth.service;

import com.fasterxml.jackson.databind.JsonNode;
import io.secureai.backend.domain.plan.PlanRepository;
import io.secureai.backend.domain.user.entity.User;
import io.secureai.backend.domain.user.repository.UserRepository;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class GitHubOAuthService {

    private final UserRepository userRepository;
    private final PlanRepository planRepository;
    private final RestTemplate restTemplate;

    @Value("${secureai.github.client-id}")
    private String clientId;

    @Value("${secureai.github.client-secret}")
    private String clientSecret;

    @Value("${secureai.frontend.url}")
    private String frontendUrl;

    public String buildAuthorizationUrl(String state) {
        return "https://github.com/login/oauth/authorize?client_id=%s&scope=user:email,repo&state=%s"
                .formatted(clientId, state);
    }

    @Transactional
    public User handleCallback(String code) {
        String accessToken = exchangeCodeForToken(code);
        JsonNode profile = fetchGitHubProfile(accessToken);

        long githubId = profile.get("id").asLong();
        String githubLogin = profile.get("login").asText();
        String email = resolveEmail(profile, accessToken);

        return userRepository.findByGithubIdAndDeletedAtIsNull(githubId)
                .map(user -> {
                    user.setGithubToken(accessToken);
                    user.setGithubLogin(githubLogin);
                    user.setGithubTokenExpiresAt(OffsetDateTime.now().plusHours(8));
                    return userRepository.save(user);
                })
                .orElseGet(() -> createUserFromGitHub(githubId, githubLogin, email, accessToken));
    }

    private User createUserFromGitHub(long githubId, String githubLogin, String email, String token) {
        if (email != null && userRepository.existsByEmailAndDeletedAtIsNull(email)) {
            // 기존 이메일 계정에 GitHub 연동
            return userRepository.findByEmailAndDeletedAtIsNull(email).map(user -> {
                user.setGithubId(githubId);
                user.setGithubLogin(githubLogin);
                user.setGithubToken(token);
                user.setEmailVerified(true);
                return userRepository.save(user);
            }).orElseThrow();
        }

        String username = generateUniqueUsername(githubLogin);
        User user = User.builder()
                .email(email != null ? email : githubLogin + "@github.noreply")
                .username(username)
                .displayName(githubLogin)
                .githubId(githubId)
                .githubLogin(githubLogin)
                .githubToken(token)
                .githubTokenExpiresAt(OffsetDateTime.now().plusHours(8))
                .emailVerified(true)
                .plan(planRepository.findByName("free")
                        .orElseThrow(() -> new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR)))
                .build();
        return userRepository.save(user);
    }

    private String exchangeCodeForToken(String code) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Accept", "application/json");

        Map<String, String> body = Map.of(
                "client_id", clientId,
                "client_secret", clientSecret,
                "code", code
        );

        ResponseEntity<JsonNode> response = restTemplate.exchange(
                "https://github.com/login/oauth/access_token",
                HttpMethod.POST,
                new HttpEntity<>(body, headers),
                JsonNode.class
        );

        if (response.getBody() == null || !response.getBody().has("access_token")) {
            throw new BusinessException(ErrorCode.GITHUB_AUTH_REQUIRED, "GitHub 토큰 교환 실패");
        }
        return response.getBody().get("access_token").asText();
    }

    private JsonNode fetchGitHubProfile(String accessToken) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "Bearer " + accessToken);
        headers.set("Accept", "application/vnd.github.v3+json");

        return restTemplate.exchange(
                "https://api.github.com/user",
                HttpMethod.GET,
                new HttpEntity<>(headers),
                JsonNode.class
        ).getBody();
    }

    private String resolveEmail(JsonNode profile, String accessToken) {
        if (profile.has("email") && !profile.get("email").isNull()) {
            return profile.get("email").asText();
        }
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Bearer " + accessToken);
            JsonNode emails = restTemplate.exchange(
                    "https://api.github.com/user/emails",
                    HttpMethod.GET,
                    new HttpEntity<>(headers),
                    JsonNode.class
            ).getBody();
            if (emails != null) {
                for (JsonNode emailNode : emails) {
                    if (emailNode.get("primary").asBoolean()) {
                        return emailNode.get("email").asText();
                    }
                }
            }
        } catch (Exception e) {
            log.warn("GitHub email fetch failed", e);
        }
        return null;
    }

    private String generateUniqueUsername(String base) {
        String username = base.toLowerCase().replaceAll("[^a-z0-9_]", "_");
        if (!userRepository.existsByUsernameAndDeletedAtIsNull(username)) {
            return username;
        }
        return username + "_" + UUID.randomUUID().toString().substring(0, 6);
    }
}
