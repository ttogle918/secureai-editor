package io.secureai.backend.domain.auth.service;

import io.secureai.backend.domain.plan.PlanRepository;
import io.secureai.backend.domain.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.*;

@ExtendWith(MockitoExtension.class)
class GitHubOAuthServiceTest {

    @Mock UserRepository userRepository;
    @Mock PlanRepository planRepository;

    private GitHubOAuthService service;

    @BeforeEach
    void setUp() {
        service = new GitHubOAuthService(userRepository, planRepository);
        ReflectionTestUtils.setField(service, "clientId", "test-client-id");
    }

    @Test
    @DisplayName("buildAuthorizationUrl — client_id/scope/state 를 포함한 GitHub 인가 URL 을 생성한다")
    void buildAuthorizationUrl_includesClientIdScopeAndState() {
        String url = service.buildAuthorizationUrl("state-xyz");

        assertThat(url).startsWith("https://github.com/login/oauth/authorize?");
        assertThat(url).contains("client_id=test-client-id");
        assertThat(url).contains("scope=user:email,repo");
        assertThat(url).contains("state=state-xyz");
    }
}
