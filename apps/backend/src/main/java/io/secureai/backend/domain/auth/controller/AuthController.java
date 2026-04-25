package io.secureai.backend.domain.auth.controller;

import io.secureai.backend.domain.auth.dto.*;
import io.secureai.backend.domain.auth.service.AuthService;
import io.secureai.backend.domain.auth.service.GitHubOAuthService;
import io.secureai.backend.domain.user.entity.User;
import io.secureai.backend.global.aop.AuditLog;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import io.secureai.backend.global.response.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private static final String OAUTH_STATE_PREFIX = "secureai:oauth:state:";

    private final AuthService authService;
    private final GitHubOAuthService gitHubOAuthService;
    private final RedisTemplate<String, String> redisTemplate;

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<RegisterResponse>> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(authService.register(request)));
    }

    @GetMapping("/verify-email")
    public ResponseEntity<ApiResponse<Map<String, String>>> verifyEmail(@RequestParam String token) {
        authService.verifyEmail(token);
        return ResponseEntity.ok(ApiResponse.success(Map.of("message", "이메일 인증이 완료되었습니다.")));
    }

    @PostMapping("/login")
    @AuditLog(action = "LOGIN")
    public ResponseEntity<ApiResponse<LoginResponse>> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse) {
        return ResponseEntity.ok(ApiResponse.success(
                authService.login(request, httpRequest, httpResponse)));
    }

    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse<TokenRefreshResponse>> refresh(
            HttpServletRequest request,
            HttpServletResponse response) {
        return ResponseEntity.ok(ApiResponse.success(authService.refresh(request, response)));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(
            @AuthenticationPrincipal UUID userId,
            HttpServletRequest request,
            HttpServletResponse response) {
        authService.logout(userId, request, response);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/github")
    public ResponseEntity<Void> githubLogin(HttpServletResponse response) throws Exception {
        String state = UUID.randomUUID().toString();
        // CSRF 방어: state를 Redis에 10분간 보관
        redisTemplate.opsForValue().set(OAUTH_STATE_PREFIX + state, "1", Duration.ofMinutes(10));
        String url = gitHubOAuthService.buildAuthorizationUrl(state);
        response.sendRedirect(url);
        return ResponseEntity.status(HttpStatus.FOUND).build();
    }

    @GetMapping("/github/callback")
    @AuditLog(action = "GITHUB_LOGIN")
    public ResponseEntity<Void> githubCallback(
            @RequestParam String code,
            @RequestParam(required = false) String state,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse) throws Exception {
        // CSRF 방어: state 검증 후 즉시 삭제 (재사용 방지)
        String stateKey = OAUTH_STATE_PREFIX + state;
        if (state == null || !Boolean.TRUE.equals(redisTemplate.hasKey(stateKey))) {
            throw new BusinessException(ErrorCode.AUTH_OAUTH_STATE_INVALID);
        }
        redisTemplate.delete(stateKey);

        User user = gitHubOAuthService.handleCallback(code);
        LoginResponse loginResponse = authService.loginWithUser(user, httpRequest, httpResponse);
        String redirectUrl = "%s/auth/callback?accessToken=%s"
                .formatted(getfrontendUrl(httpRequest), loginResponse.getAccessToken());
        httpResponse.sendRedirect(redirectUrl);
        return ResponseEntity.status(HttpStatus.FOUND).build();
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<ApiResponse<Map<String, String>>> forgotPassword(
            @Valid @RequestBody ForgotPasswordRequest request) {
        authService.forgotPassword(request.getEmail());
        return ResponseEntity.ok(ApiResponse.success(
                Map.of("message", "비밀번호 재설정 안내 메일을 발송했습니다.")));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<ApiResponse<Map<String, String>>> resetPassword(
            @Valid @RequestBody ResetPasswordRequest request) {
        authService.resetPassword(request);
        return ResponseEntity.ok(ApiResponse.success(Map.of("message", "비밀번호가 재설정되었습니다.")));
    }

    private String getfrontendUrl(HttpServletRequest request) {
        String origin = request.getHeader("Origin");
        return origin != null ? origin : "http://localhost:3000";
    }
}
