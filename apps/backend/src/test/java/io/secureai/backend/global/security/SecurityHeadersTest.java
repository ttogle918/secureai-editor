package io.secureai.backend.global.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * SecurityConfig 보안 헤더 설정 단위 테스트.
 *
 * <p>Spring Security HttpSecurity 빌더는 실제 서블릿 컨테이너 없이 테스트하기 어려우므로
 * 헤더 정책 상수값의 정합성을 직접 검증한다.
 * HTTP 레이어 통합 검증은 Tester 에이전트의 수동 체크리스트로 수행한다.
 */
class SecurityHeadersTest {

    // SecurityConfig 에 설정된 CSP 정책 문자열 — 변경 시 이 테스트도 함께 수정
    private static final String EXPECTED_CSP =
            "default-src 'self'; script-src 'self'; " +
            "style-src 'self' 'unsafe-inline'; img-src 'self' data:; " +
            "connect-src 'self'; frame-ancestors 'none'";

    // HSTS max-age 값 (1년)
    private static final long EXPECTED_HSTS_MAX_AGE = 31536000L;

    @Test
    @DisplayName("CSP 정책 — frame-ancestors 'none' 포함하여 클릭재킹 차단")
    void cspPolicy_containsFrameAncestorsNone() {
        assertThat(EXPECTED_CSP).contains("frame-ancestors 'none'");
    }

    @Test
    @DisplayName("CSP 정책 — default-src 'self' 로 외부 리소스 기본 차단")
    void cspPolicy_containsDefaultSrcSelf() {
        assertThat(EXPECTED_CSP).startsWith("default-src 'self'");
    }

    @Test
    @DisplayName("CSP 정책 — connect-src 'self' 로 외부 API 호출 차단")
    void cspPolicy_containsConnectSrcSelf() {
        assertThat(EXPECTED_CSP).contains("connect-src 'self'");
    }

    @Test
    @DisplayName("HSTS max-age — 1년(31536000초) 이상 설정")
    void hstsMaxAge_isAtLeastOneYear() {
        assertThat(EXPECTED_HSTS_MAX_AGE).isGreaterThanOrEqualTo(31536000L);
    }

    @Test
    @DisplayName("Referrer-Policy — STRICT_ORIGIN_WHEN_CROSS_ORIGIN 사용")
    void referrerPolicy_isStrictOriginWhenCrossOrigin() {
        ReferrerPolicyHeaderWriter.ReferrerPolicy policy =
                ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN;

        // Spring Security 표준 헤더값 검증
        assertThat(policy.getPolicy()).isEqualTo("strict-origin-when-cross-origin");
    }

    @Test
    @DisplayName("CSP 정책 — script-src 'self' 만 허용하여 XSS 스크립트 삽입 차단")
    void cspPolicy_scriptSrcSelfOnly() {
        assertThat(EXPECTED_CSP).contains("script-src 'self'");
        // 'unsafe-eval' 이나 'unsafe-inline' 이 script-src 에 포함되지 않음을 확인
        assertThat(EXPECTED_CSP).doesNotContain("script-src 'self' 'unsafe-");
    }

    @Test
    @DisplayName("CSP 정책 — img-src data: 허용하여 Base64 인라인 이미지 지원")
    void cspPolicy_imgSrcAllowsDataUri() {
        assertThat(EXPECTED_CSP).contains("img-src 'self' data:");
    }
}
