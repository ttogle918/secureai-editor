package io.secureai.backend.domain.cve.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.secureai.backend.domain.cve.entity.CveData;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.HexFormat;

@Slf4j
@Component
public class NvdApiClient {

    private static final String NVD_BASE_URL = "https://services.nvd.nist.gov/rest/json/cves/2.0";
    private static final String CACHE_PREFIX  = "secureai:nvd:page:";
    private static final Duration CACHE_TTL   = Duration.ofHours(6);

    private static final int MAX_RETRY        = 3;
    private static final long[] BACKOFF_SECONDS = {30L, 60L, 120L};

    private final RestClient restClient;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    public NvdApiClient(StringRedisTemplate redisTemplate, ObjectMapper objectMapper) {
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10_000);
        factory.setReadTimeout(30_000);
        this.restClient = RestClient.builder().requestFactory(factory).build();
    }

    @Value("${secureai.nvd.api-key:}")
    private String nvdApiKey;

    @CircuitBreaker(name = "nvdApi", fallbackMethod = "fetchRecentCvesFallback")
    public List<CveData> fetchRecentCves(int daysBack) {
        OffsetDateTime end   = OffsetDateTime.now();
        OffsetDateTime start = end.minusDays(daysBack);

        String params = buildQueryParams(start, end);
        String cacheKey = CACHE_PREFIX + sha256(params);

        String cached = redisTemplate.opsForValue().get(cacheKey);
        if (cached != null) {
            return parseCveList(cached);
        }

        String responseBody = fetchWithRetry(params);
        if (responseBody == null) {
            return List.of();
        }

        redisTemplate.opsForValue().set(cacheKey, responseBody, CACHE_TTL);
        return parseCveList(responseBody);
    }

    @SuppressWarnings("unused")
    private List<CveData> fetchRecentCvesFallback(int daysBack, Throwable t) {
        log.warn("[circuit] fetchRecentCves fallback triggered daysBack={} cause={}", daysBack, t.getMessage());
        return List.of();
    }

    private String buildQueryParams(OffsetDateTime start, OffsetDateTime end) {
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS");
        return "?pubStartDate=" + start.format(fmt) + "&pubEndDate=" + end.format(fmt);
    }

    private String fetchWithRetry(String queryParams) {
        for (int attempt = 0; attempt < MAX_RETRY; attempt++) {
            try {
                RestClient.RequestHeadersSpec<?> spec = restClient.get().uri(NVD_BASE_URL + queryParams);
                if (!nvdApiKey.isBlank()) {
                    spec = spec.header("apiKey", nvdApiKey);
                }
                String body = spec.retrieve().body(String.class);
                return body;
            } catch (Exception e) {
                if (isRateLimitError(e) && attempt < MAX_RETRY - 1) {
                    long backoff = BACKOFF_SECONDS[attempt];
                    log.warn("[nvd] 429 rate limit — backoff {}s (attempt {}/{})", backoff, attempt + 1, MAX_RETRY);
                    sleepQuietly(backoff);
                } else {
                    log.error("[nvd] API 호출 실패 attempt={}: {}", attempt + 1, e.getMessage());
                    if (attempt == MAX_RETRY - 1) return null;
                }
            }
        }
        return null;
    }

    private boolean isRateLimitError(Exception e) {
        return e.getMessage() != null && e.getMessage().contains("429");
    }

    private void sleepQuietly(long seconds) {
        try {
            Thread.sleep(Duration.ofSeconds(seconds));
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
        }
    }

    private List<CveData> parseCveList(String json) {
        List<CveData> result = new ArrayList<>();
        try {
            JsonNode root = objectMapper.readTree(json);
            JsonNode vulnerabilities = root.path("vulnerabilities");
            for (JsonNode item : vulnerabilities) {
                JsonNode cve = item.path("cve");
                result.add(parseCveNode(cve));
            }
        } catch (Exception e) {
            log.error("[nvd] CVE JSON 파싱 실패: {}", e.getMessage());
        }
        return result;
    }

    private CveData parseCveNode(JsonNode cve) {
        String cveId      = cve.path("id").asText();
        String description = extractDescription(cve);
        BigDecimal score  = extractCvssScore(cve);
        String vector     = extractCvssVector(cve);
        String severity   = deriveSeverity(score);

        OffsetDateTime publishedAt = parseOffsetDateTime(cve.path("published").asText(null));
        OffsetDateTime modifiedAt  = parseOffsetDateTime(cve.path("lastModified").asText(null));

        String affected = extractAffectedProducts(cve);

        return CveData.builder()
                .cveId(cveId)
                .description(description)
                .cvssScore(score)
                .cvssVector(vector)
                .severity(severity)
                .publishedAt(publishedAt)
                .modifiedAt(modifiedAt)
                .affectedProducts(affected)
                .build();
    }

    private String extractDescription(JsonNode cve) {
        JsonNode descs = cve.path("descriptions");
        for (JsonNode d : descs) {
            if ("en".equals(d.path("lang").asText())) {
                return d.path("value").asText(null);
            }
        }
        return null;
    }

    private BigDecimal extractCvssScore(JsonNode cve) {
        JsonNode metrics = cve.path("metrics");
        for (String key : List.of("cvssMetricV31", "cvssMetricV30", "cvssMetricV2")) {
            JsonNode list = metrics.path(key);
            if (list.isArray() && list.size() > 0) {
                JsonNode score = list.get(0).path("cvssData").path("baseScore");
                if (!score.isMissingNode()) {
                    return new BigDecimal(score.asText());
                }
            }
        }
        return null;
    }

    private String extractCvssVector(JsonNode cve) {
        JsonNode metrics = cve.path("metrics");
        for (String key : List.of("cvssMetricV31", "cvssMetricV30", "cvssMetricV2")) {
            JsonNode list = metrics.path(key);
            if (list.isArray() && list.size() > 0) {
                String vector = list.get(0).path("cvssData").path("vectorString").asText(null);
                if (vector != null) return vector;
            }
        }
        return null;
    }

    private String deriveSeverity(BigDecimal score) {
        if (score == null) return null;
        double v = score.doubleValue();
        if (v >= 9.0) return "CRITICAL";
        if (v >= 7.0) return "HIGH";
        if (v >= 4.0) return "MEDIUM";
        return "LOW";
    }

    private String extractAffectedProducts(JsonNode cve) {
        try {
            JsonNode configs = cve.path("configurations");
            if (!configs.isMissingNode()) {
                return objectMapper.writeValueAsString(configs);
            }
        } catch (Exception ignored) {
        }
        return "[]";
    }

    private OffsetDateTime parseOffsetDateTime(String text) {
        if (text == null || text.isBlank()) return null;
        try {
            return OffsetDateTime.parse(text);
        } catch (Exception e) {
            return null;
        }
    }

    private String sha256(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            return input.hashCode() + "";
        }
    }
}
