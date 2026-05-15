package io.secureai.backend.global.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.AntPathMatcher;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;

/**
 * AI Engine → Backend 내부 호출 경로에 대한 X-Internal-Key 검증 필터.
 *
 * Security 설정에서 permitAll()로 JWT 인증을 우회하더라도
 * 이 필터가 내부 키 검증을 수행하여 외부 접근을 차단한다.
 *
 * 검증 대상 경로:
 * - GET  /api/v1/cve/search
 * - POST /api/v1/sbom/components
 * - POST /api/v1/internal/**
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class InternalKeyAuthFilter extends OncePerRequestFilter {

    private static final String INTERNAL_KEY_HEADER = "X-Internal-Key";

    private static final List<String> INTERNAL_PATTERNS = List.of(
            "/api/v1/internal/**",
            "/api/v1/cve/search",
            "/api/v1/sbom/components"
    );

    private final AntPathMatcher pathMatcher = new AntPathMatcher();

    @Value("${secureai.internal-api-key}")
    private String internalApiKey;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return INTERNAL_PATTERNS.stream().noneMatch(pattern -> pathMatcher.match(pattern, path));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String provided = request.getHeader(INTERNAL_KEY_HEADER);

        if (!isKeyValid(provided)) {
            // 내부 키 불일치 — 키 값 자체는 절대 로그 출력 금지
            log.warn("[internal-auth] X-Internal-Key mismatch path={} remoteAddr={}",
                    request.getRequestURI(), request.getRemoteAddr());
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.getWriter().write("{\"error\":\"Invalid internal API key\"}");
            return;
        }

        filterChain.doFilter(request, response);
    }

    /**
     * 상수 시간 비교로 타이밍 공격을 방지한다.
     */
    private boolean isKeyValid(String provided) {
        if (provided == null || internalApiKey == null) {
            return false;
        }
        byte[] a = provided.getBytes(StandardCharsets.UTF_8);
        byte[] b = internalApiKey.getBytes(StandardCharsets.UTF_8);
        return MessageDigest.isEqual(a, b);
    }
}
