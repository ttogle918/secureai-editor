package io.secureai.backend.infrastructure.observability;

import io.sentry.EventProcessor;
import io.sentry.Hint;
import io.sentry.SentryEvent;
import io.sentry.protocol.Request;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Sentry PII 스크럽 필터 (TASK-1804 보안 필수)
 *
 * <p>민감 데이터가 Sentry로 전송되지 않도록 before_send 훅 역할을 수행한다.
 * 스크럽 대상: Authorization/X-Internal-Key 헤더, password 파라미터, JWT 패턴
 *
 * <p>SRP: 이 클래스는 PII 스크럽 책임만 가진다.
 * DIP: EventProcessor 인터페이스에 의존하여 Sentry SDK 내부에 결합하지 않는다.
 */
@Component
public class SentryPiiScrubber implements EventProcessor {

    private static final String REDACTED = "[REDACTED]";

    // 스크럽할 HTTP 헤더 (대소문자 무관)
    private static final Set<String> SENSITIVE_HEADERS = Set.of(
            "authorization",
            "x-internal-key",
            "cookie",
            "set-cookie",
            "x-api-key"
    );

    // 스크럽할 쿼리/바디 파라미터 키
    private static final Set<String> SENSITIVE_PARAMS = Set.of(
            "password",
            "passwd",
            "secret",
            "token",
            "access_token",
            "refresh_token",
            "api_key",
            "private_key"
    );

    // JWT 패턴 — eyJ로 시작하는 토큰
    private static final Pattern JWT_PATTERN =
            Pattern.compile("eyJ[A-Za-z0-9\\-_]+\\.[A-Za-z0-9\\-_]+\\.[A-Za-z0-9\\-_]*");

    @Override
    public SentryEvent process(SentryEvent event, Hint hint) {
        if (event == null) {
            return null;
        }
        scrubRequest(event.getRequest());
        return event;
    }

    private void scrubRequest(Request request) {
        if (request == null) {
            return;
        }
        scrubHeaders(request.getHeaders());
        scrubQueryString(request);
        scrubBodyData(request.getData());
    }

    private void scrubHeaders(Map<String, String> headers) {
        if (headers == null) {
            return;
        }
        for (String key : List.copyOf(headers.keySet())) {
            if (SENSITIVE_HEADERS.contains(key.toLowerCase())) {
                headers.put(key, REDACTED);
            }
        }
    }

    private void scrubQueryString(Request request) {
        String queryString = request.getQueryString();
        if (queryString == null || queryString.isBlank()) {
            return;
        }
        // JWT 패턴이 쿼리 스트링에 있으면 전체 마스킹
        if (JWT_PATTERN.matcher(queryString).find()) {
            request.setQueryString(REDACTED);
            return;
        }
        // 민감 파라미터 키=값 쌍 마스킹
        String scrubbed = maskSensitiveParams(queryString);
        request.setQueryString(scrubbed);
    }

    @SuppressWarnings("unchecked")
    private void scrubBodyData(Object data) {
        if (!(data instanceof Map)) {
            return;
        }
        Map<String, Object> bodyMap = (Map<String, Object>) data;
        for (String key : List.copyOf(bodyMap.keySet())) {
            if (SENSITIVE_PARAMS.contains(key.toLowerCase())) {
                bodyMap.put(key, REDACTED);
            }
        }
    }

    /**
     * 쿼리 스트링에서 민감 파라미터를 마스킹한다.
     * 예: password=secret123 → password=[REDACTED]
     */
    String maskSensitiveParams(String queryString) {
        String[] pairs = queryString.split("&");
        StringBuilder result = new StringBuilder();
        for (String pair : pairs) {
            if (!result.isEmpty()) {
                result.append("&");
            }
            int eqIdx = pair.indexOf('=');
            if (eqIdx < 0) {
                result.append(pair);
                continue;
            }
            String key = pair.substring(0, eqIdx);
            if (SENSITIVE_PARAMS.contains(key.toLowerCase())) {
                result.append(key).append("=").append(REDACTED);
            } else {
                result.append(pair);
            }
        }
        return result.toString();
    }

    /**
     * JWT 패턴 탐지 여부 반환 — 테스트에서 직접 사용
     */
    boolean containsJwt(String value) {
        return JWT_PATTERN.matcher(value).find();
    }
}
