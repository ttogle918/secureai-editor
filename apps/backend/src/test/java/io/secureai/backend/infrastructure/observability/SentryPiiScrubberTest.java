package io.secureai.backend.infrastructure.observability;

import io.sentry.Hint;
import io.sentry.SentryEvent;
import io.sentry.protocol.Request;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * SentryPiiScrubber 단위 테스트 (TASK-1804 필수 보안 검증)
 *
 * <p>민감 데이터(JWT/Authorization/X-Internal-Key/password)가
 * Sentry 이벤트에서 제거되는지 확인한다.
 */
@DisplayName("SentryPiiScrubber — PII 필터 단위 테스트")
class SentryPiiScrubberTest {

    private SentryPiiScrubber scrubber;

    @BeforeEach
    void setUp() {
        scrubber = new SentryPiiScrubber();
    }

    // ── Authorization 헤더 스크럽 ──────────────────────────────────

    @Test
    @DisplayName("Authorization 헤더는 [REDACTED]로 교체된다")
    void shouldRedactAuthorizationHeader() {
        SentryEvent event = buildEventWithHeader("Authorization", "Bearer eyJsecrettoken");

        SentryEvent result = scrubber.process(event, new Hint());

        assertThat(result.getRequest().getHeaders())
                .containsEntry("Authorization", "[REDACTED]");
    }

    @Test
    @DisplayName("X-Internal-Key 헤더는 [REDACTED]로 교체된다")
    void shouldRedactXInternalKeyHeader() {
        SentryEvent event = buildEventWithHeader("X-Internal-Key", "super-secret-internal-key");

        SentryEvent result = scrubber.process(event, new Hint());

        assertThat(result.getRequest().getHeaders())
                .containsEntry("X-Internal-Key", "[REDACTED]");
    }

    @Test
    @DisplayName("헤더 키 대소문자 무관 스크럽")
    void shouldRedactHeaderCaseInsensitive() {
        SentryEvent event = buildEventWithHeader("authorization", "Bearer token123");

        SentryEvent result = scrubber.process(event, new Hint());

        assertThat(result.getRequest().getHeaders())
                .containsEntry("authorization", "[REDACTED]");
    }

    @Test
    @DisplayName("비민감 헤더(Content-Type)는 보존된다")
    void shouldPreserveNonSensitiveHeader() {
        SentryEvent event = buildEventWithHeader("Content-Type", "application/json");

        SentryEvent result = scrubber.process(event, new Hint());

        assertThat(result.getRequest().getHeaders())
                .containsEntry("Content-Type", "application/json");
    }

    // ── 쿼리 스트링 스크럽 ──────────────────────────────────────────

    @Test
    @DisplayName("쿼리 스트링에서 password 파라미터를 마스킹한다")
    void shouldMaskPasswordInQueryString() {
        SentryEvent event = buildEventWithQueryString("username=user&password=secret123");

        SentryEvent result = scrubber.process(event, new Hint());

        assertThat(result.getRequest().getQueryString())
                .contains("password=[REDACTED]")
                .doesNotContain("secret123");
    }

    @Test
    @DisplayName("쿼리 스트링에 JWT 패턴이 있으면 전체를 [REDACTED]로 교체한다")
    void shouldRedactQueryStringContainingJwt() {
        String jwtToken = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
        SentryEvent event = buildEventWithQueryString("token=" + jwtToken);

        SentryEvent result = scrubber.process(event, new Hint());

        assertThat(result.getRequest().getQueryString()).isEqualTo("[REDACTED]");
    }

    @Test
    @DisplayName("비민감 쿼리 파라미터는 보존된다")
    void shouldPreserveNonSensitiveQueryParam() {
        SentryEvent event = buildEventWithQueryString("page=1&size=10");

        SentryEvent result = scrubber.process(event, new Hint());

        assertThat(result.getRequest().getQueryString()).isEqualTo("page=1&size=10");
    }

    // ── 바디 데이터 스크럽 ─────────────────────────────────────────

    @Test
    @DisplayName("요청 바디에서 password 키를 스크럽한다")
    void shouldRedactPasswordInBodyData() {
        SentryEvent event = new SentryEvent();
        Request request = new Request();
        Map<String, Object> body = new HashMap<>();
        body.put("username", "user@example.com");
        body.put("password", "mySecretPassword");
        request.setData(body);
        event.setRequest(request);

        SentryEvent result = scrubber.process(event, new Hint());

        Map<String, Object> data = (Map<String, Object>) result.getRequest().getData();
        assertThat(data)
                .containsEntry("password", "[REDACTED]")
                .containsEntry("username", "user@example.com");
    }

    @Test
    @DisplayName("바디에서 token 키를 스크럽한다")
    void shouldRedactTokenInBodyData() {
        SentryEvent event = new SentryEvent();
        Request request = new Request();
        Map<String, Object> body = new HashMap<>();
        body.put("access_token", "eyJhbGci...");
        body.put("email", "test@example.com");
        request.setData(body);
        event.setRequest(request);

        SentryEvent result = scrubber.process(event, new Hint());

        Map<String, Object> data = (Map<String, Object>) result.getRequest().getData();
        assertThat(data)
                .containsEntry("access_token", "[REDACTED]")
                .containsEntry("email", "test@example.com");
    }

    // ── null 안전성 ────────────────────────────────────────────────

    @Test
    @DisplayName("null 이벤트는 null을 반환한다")
    void shouldReturnNullForNullEvent() {
        SentryEvent result = scrubber.process((SentryEvent) null, new Hint());
        assertThat(result).isNull();
    }

    @Test
    @DisplayName("Request가 없는 이벤트는 그대로 반환된다")
    void shouldHandleEventWithoutRequest() {
        SentryEvent event = new SentryEvent();

        SentryEvent result = scrubber.process(event, new Hint());

        assertThat(result).isNotNull();
        assertThat(result.getRequest()).isNull();
    }

    // ── JWT 탐지 헬퍼 ───────────────────────────────────────────────

    @Test
    @DisplayName("유효한 JWT 형식을 탐지한다")
    void shouldDetectJwtPattern() {
        String jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
        assertThat(scrubber.containsJwt(jwt)).isTrue();
    }

    @Test
    @DisplayName("일반 문자열은 JWT로 탐지하지 않는다")
    void shouldNotDetectNonJwtAsJwt() {
        assertThat(scrubber.containsJwt("plain-text-token")).isFalse();
    }

    // ── maskSensitiveParams 직접 테스트 ─────────────────────────────

    @Test
    @DisplayName("복합 쿼리 스트링에서 민감 파라미터만 마스킹된다")
    void shouldMaskOnlySensitiveParamsInCompoundQueryString() {
        String result = scrubber.maskSensitiveParams("name=alice&password=secretval&age=30&token=tokenval");
        assertThat(result)
                .contains("name=alice")
                .contains("age=30")
                .contains("password=[REDACTED]")
                .contains("token=[REDACTED]")
                .doesNotContain("secretval")
                .doesNotContain("tokenval");
    }

    // ── 헬퍼 메서드 ─────────────────────────────────────────────────

    private SentryEvent buildEventWithHeader(String key, String value) {
        SentryEvent event = new SentryEvent();
        Request request = new Request();
        Map<String, String> headers = new HashMap<>();
        headers.put(key, value);
        request.setHeaders(headers);
        event.setRequest(request);
        return event;
    }

    private SentryEvent buildEventWithQueryString(String queryString) {
        SentryEvent event = new SentryEvent();
        Request request = new Request();
        request.setQueryString(queryString);
        event.setRequest(request);
        return event;
    }
}
