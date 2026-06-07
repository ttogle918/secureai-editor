package io.secureai.backend.domain.auth.controller;

import io.secureai.backend.domain.auth.dto.LoginResponse;
import io.secureai.backend.domain.auth.dto.RegisterRequest;
import io.secureai.backend.domain.auth.dto.RegisterResponse;
import io.secureai.backend.domain.auth.service.AuthService;
import io.secureai.backend.domain.auth.service.GitHubOAuthService;
import io.secureai.backend.domain.user.entity.User;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import io.secureai.backend.global.response.ApiResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * AuthController 단위 테스트 — DastControllerTest 컨벤션을 따라 MockMvc 없이
 * 컨트롤러 메서드를 직접 호출한다. 위임/상태코드와 OAuth state CSRF·일회용 코드
 * 교환 같은 보안 분기를 중점적으로 검증한다.
 */
@ExtendWith(MockitoExtension.class)
class AuthControllerTest {

    @Mock AuthService authService;
    @Mock GitHubOAuthService gitHubOAuthService;
    @Mock RedisTemplate<String, String> redisTemplate;
    @Mock ValueOperations<String, String> valueOps;

    private AuthController controller;

    private static final String STATE_PREFIX = "secureai:oauth:state:";
    private static final String CODE_PREFIX = "secureai:oauth:code:";

    @BeforeEach
    void setUp() {
        controller = new AuthController(authService, gitHubOAuthService, redisTemplate);
        ReflectionTestUtils.setField(controller, "frontendUrl", "http://front");
    }

    // ── register / verifyEmail / logout 위임 ──────────────────────────────────

    @Test
    @DisplayName("register — authService.register 결과를 201 CREATED 로 래핑한다")
    void register_returns201() {
        RegisterRequest req = mock(RegisterRequest.class);
        RegisterResponse expected = mock(RegisterResponse.class);
        when(authService.register(req)).thenReturn(expected);

        ResponseEntity<ApiResponse<RegisterResponse>> response = controller.register(req);

        assertThat(response.getStatusCode().value()).isEqualTo(201);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getData()).isSameAs(expected);
    }

    @Test
    @DisplayName("verifyEmail — 토큰을 서비스에 위임하고 200 을 반환한다")
    void verifyEmail_delegatesAndReturns200() {
        ResponseEntity<ApiResponse<Map<String, String>>> response = controller.verifyEmail("tok-1");

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        verify(authService).verifyEmail("tok-1");
    }

    @Test
    @DisplayName("logout — 서비스에 위임하고 204 No Content 를 반환한다")
    void logout_returns204() {
        UUID userId = UUID.randomUUID();
        MockHttpServletRequest req = new MockHttpServletRequest();
        MockHttpServletResponse resp = new MockHttpServletResponse();

        ResponseEntity<Void> response = controller.logout(userId, req, resp);

        assertThat(response.getStatusCode().value()).isEqualTo(204);
        verify(authService).logout(userId, req, resp);
    }

    // ── exchangeOAuthCode (보안: 일회용 코드) ──────────────────────────────────

    @Test
    @DisplayName("exchangeOAuthCode — UUID 형식이 아니면 AUTH_OAUTH_CODE_INVALID")
    void exchangeOAuthCode_nonUuid_throws() {
        assertThatThrownBy(() -> controller.exchangeOAuthCode("not-a-uuid"))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getErrorCode())
                        .isEqualTo(ErrorCode.AUTH_OAUTH_CODE_INVALID));
        verifyNoInteractions(redisTemplate);
    }

    @Test
    @DisplayName("exchangeOAuthCode — Redis 에 코드가 없으면 AUTH_OAUTH_CODE_INVALID")
    void exchangeOAuthCode_missingInRedis_throws() {
        String code = UUID.randomUUID().toString();
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(valueOps.get(CODE_PREFIX + code)).thenReturn(null);

        assertThatThrownBy(() -> controller.exchangeOAuthCode(code))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getErrorCode())
                        .isEqualTo(ErrorCode.AUTH_OAUTH_CODE_INVALID));
    }

    @Test
    @DisplayName("exchangeOAuthCode — 유효한 코드는 accessToken 을 반환하고 키를 즉시 삭제한다 (재사용 방지)")
    void exchangeOAuthCode_valid_returnsTokenAndDeletes() {
        String code = UUID.randomUUID().toString();
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(valueOps.get(CODE_PREFIX + code)).thenReturn("jwt-abc");

        ResponseEntity<ApiResponse<Map<String, String>>> response = controller.exchangeOAuthCode(code);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().getData()).containsEntry("accessToken", "jwt-abc");
        verify(redisTemplate).delete(CODE_PREFIX + code);
    }

    // ── githubCallback (보안: state CSRF) ─────────────────────────────────────

    @Test
    @DisplayName("githubCallback — state 가 null 이면 AUTH_OAUTH_STATE_INVALID")
    void githubCallback_nullState_throws() {
        MockHttpServletRequest req = new MockHttpServletRequest();
        MockHttpServletResponse resp = new MockHttpServletResponse();

        assertThatThrownBy(() -> controller.githubCallback("code", null, req, resp))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getErrorCode())
                        .isEqualTo(ErrorCode.AUTH_OAUTH_STATE_INVALID));
    }

    @Test
    @DisplayName("githubCallback — state 가 Redis 에 없으면 AUTH_OAUTH_STATE_INVALID")
    void githubCallback_unknownState_throws() {
        when(redisTemplate.hasKey(STATE_PREFIX + "s1")).thenReturn(false);
        MockHttpServletRequest req = new MockHttpServletRequest();
        MockHttpServletResponse resp = new MockHttpServletResponse();

        assertThatThrownBy(() -> controller.githubCallback("code", "s1", req, resp))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getErrorCode())
                        .isEqualTo(ErrorCode.AUTH_OAUTH_STATE_INVALID));
        verify(gitHubOAuthService, never()).handleCallback(any());
    }

    @Test
    @DisplayName("githubCallback — 유효한 state 는 즉시 삭제하고, 토큰을 일회용 코드로 저장한 뒤 프론트로 리다이렉트한다")
    void githubCallback_validState_redirectsWithOneTimeCode() throws Exception {
        when(redisTemplate.hasKey(STATE_PREFIX + "s1")).thenReturn(true);
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        User user = mock(User.class);
        when(gitHubOAuthService.handleCallback("code1")).thenReturn(user);
        MockHttpServletRequest req = new MockHttpServletRequest();
        MockHttpServletResponse resp = new MockHttpServletResponse();
        LoginResponse loginResponse = mock(LoginResponse.class);
        when(loginResponse.getAccessToken()).thenReturn("jwt-abc");
        when(authService.loginWithUser(eq(user), eq(req), eq(resp))).thenReturn(loginResponse);

        ResponseEntity<Void> response = controller.githubCallback("code1", "s1", req, resp);

        assertThat(response.getStatusCode().value()).isEqualTo(302);
        // 사용한 state 는 재사용 방지를 위해 삭제된다
        verify(redisTemplate).delete(STATE_PREFIX + "s1");
        // JWT 는 URL 에 직접 노출되지 않고 일회용 코드로 Redis 에 저장된다 (60초 TTL)
        verify(valueOps).set(startsWith(CODE_PREFIX), eq("jwt-abc"), eq(Duration.ofSeconds(60)));
        // 프론트엔드 콜백으로 리다이렉트되며 JWT 가 아닌 code 만 노출된다
        assertThat(resp.getRedirectedUrl()).startsWith("http://front/auth/callback?code=");
        assertThat(resp.getRedirectedUrl()).doesNotContain("jwt-abc");
    }
}
