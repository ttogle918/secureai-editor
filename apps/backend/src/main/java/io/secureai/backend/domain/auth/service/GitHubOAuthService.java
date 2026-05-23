package io.secureai.backend.domain.auth.service;

import io.secureai.backend.domain.plan.PlanRepository;
import io.secureai.backend.domain.user.entity.User;
import io.secureai.backend.domain.user.repository.UserRepository;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class GitHubOAuthService {

    private final UserRepository userRepository;
    private final PlanRepository planRepository;

    @Value("${secureai.github.client-id}")
    private String clientId;

    @Value("${secureai.github.client-secret}")
    private String clientSecret;

    @Value("${secureai.frontend.url}")
    private String frontendUrl;

    private RestClient gitHubClient;

    @PostConstruct
    void init() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10_000);
        factory.setReadTimeout(30_000);
        this.gitHubClient = RestClient.builder()
                .requestFactory(factory)
                .defaultHeader("Accept", MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader("User-Agent", "secureai-backend/1.0")
                .build();
    }

    public String buildAuthorizationUrl(String state) {
        return "https://github.com/login/oauth/authorize?client_id=%s&scope=user:email,repo&state=%s"
                .formatted(clientId, state);
    }

    @Transactional
    public User handleCallback(String code) {
        String accessToken = exchangeCodeForToken(code);
        Map<String, Object> profile = fetchGitHubProfile(accessToken);

        long githubId = ((Number) profile.get("id")).longValue();
        String githubLogin = (String) profile.get("login");
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
        Map<String, Object> body = Map.of(
                "client_id", clientId,
                "client_secret", clientSecret,
                "code", code
        );

        Map<String, Object> response = gitHubClient.post()
                .uri("https://github.com/login/oauth/access_token")
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(new ParameterizedTypeReference<>() {});

        if (response == null || !response.containsKey("access_token")) {
            throw new BusinessException(ErrorCode.GITHUB_AUTH_REQUIRED, "GitHub 토큰 교환 실패");
        }
        return (String) response.get("access_token");
    }

    private Map<String, Object> fetchGitHubProfile(String accessToken) {
        return gitHubClient.get()
                .uri("https://api.github.com/user")
                .header("Authorization", "Bearer " + accessToken)
                .header("Accept", "application/vnd.github.v3+json")
                .retrieve()
                .body(new ParameterizedTypeReference<>() {});
    }

    private String resolveEmail(Map<String, Object> profile, String accessToken) {
        Object emailVal = profile.get("email");
        if (emailVal != null && !(emailVal instanceof String s && s.isBlank())) {
            return (String) emailVal;
        }
        try {
            List<Map<String, Object>> emails = gitHubClient.get()
                    .uri("https://api.github.com/user/emails")
                    .header("Authorization", "Bearer " + accessToken)
                    .retrieve()
                    .body(new ParameterizedTypeReference<>() {});
            if (emails != null) {
                for (Map<String, Object> emailEntry : emails) {
                    if (Boolean.TRUE.equals(emailEntry.get("primary"))) {
                        return (String) emailEntry.get("email");
                    }
                }
            }
        } catch (RestClientException e) {
            log.warn("GitHub email fetch failed: {}", e.getMessage());
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
