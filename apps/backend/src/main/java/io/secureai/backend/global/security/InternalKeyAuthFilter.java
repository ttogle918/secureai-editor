package io.secureai.backend.global.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * AI Engine → Backend 내부 엔드포인트(/api/v1/internal/**)에 대한 X-Internal-Key 헤더 검증 필터.
 * JWT가 없는 내부 서비스 호출이므로 SecurityConfig에서는 permitAll()로 열어두고
 * 이 필터에서 사전 인증 키를 검사한다.
 */
@Component
public class InternalKeyAuthFilter extends OncePerRequestFilter {

    private static final String HEADER_NAME = "X-Internal-Key";
    private static final String INTERNAL_PATH_PREFIX = "/api/v1/internal/";

    private final String expectedKey;

    public InternalKeyAuthFilter(@Value("${secureai.internal-api-key}") String expectedKey) {
        this.expectedKey = expectedKey;
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain chain
    ) throws ServletException, IOException {
        if (!request.getRequestURI().startsWith(INTERNAL_PATH_PREFIX)) {
            chain.doFilter(request, response);
            return;
        }
        String provided = request.getHeader(HEADER_NAME);
        // 상수시간 비교 — 타이밍 공격 방지 (AI Engine 측 secrets.compare_digest와 동작 일치)
        if (provided == null || !constantTimeEquals(provided, expectedKey)) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            return;
        }
        chain.doFilter(request, response);
    }

    private static boolean constantTimeEquals(String a, String b) {
        return MessageDigest.isEqual(
                a.getBytes(StandardCharsets.UTF_8),
                b.getBytes(StandardCharsets.UTF_8));
    }
}
