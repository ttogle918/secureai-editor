package io.secureai.backend.domain.dast.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.secureai.backend.domain.dast.dto.DastExecuteResponse;
import io.secureai.backend.domain.dast.entity.ExploitResult;
import io.secureai.backend.domain.dast.entity.ScanStatus;
import io.secureai.backend.domain.dast.repository.ExploitResultRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

/**
 * DAST 실행 결과를 DB에 저장하고 Redis SSE 채널에 발행한다.
 * Redis 채널: {@code secureai:dast:logs:{sessionId}}
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DastResultHandler {

    private static final String REDIS_CHANNEL_PREFIX = "secureai:dast:logs:";

    private final ExploitResultRepository exploitResultRepository;
    private final RedisTemplate<String, String> redisTemplate;
    private final ObjectMapper objectMapper;

    /**
     * 실행 결과를 DB에 반영하고 Redis 채널에 발행한다.
     *
     * @param sessionId DAST 세션 ID
     * @param vulnId    취약점 ID
     * @param response  실행 결과 (payload, responseSnippet 은 AES 암호화 처리됨)
     */
    @Transactional
    public void handle(UUID sessionId, UUID vulnId, DastExecuteResponse response) {
        ExploitResult result = findOrCreate(sessionId, vulnId, response);
        updateResult(result, sessionId, response);
        exploitResultRepository.save(result);

        publishToRedis(sessionId, vulnId, response);
    }

    // ── private helpers ───────────────────────────────────────────────────────

    private ExploitResult findOrCreate(UUID sessionId, UUID vulnId, DastExecuteResponse response) {
        return exploitResultRepository.findByVulnId(vulnId)
                .orElseGet(() -> {
                    log.debug("ExploitResult not found for vulnId={}, creating new record", vulnId);
                    return ExploitResult.builder()
                            .sessionId(sessionId)
                            .vulnId(vulnId)
                            .vulnType("UNKNOWN")
                            .targetUrl("")
                            .status(ScanStatus.PENDING)
                            .executedAt(OffsetDateTime.now())
                            .build();
                });
    }

    private void updateResult(ExploitResult result, UUID sessionId, DastExecuteResponse response) {
        result.setSessionId(sessionId);
        result.setSuccess(response.success());
        result.setEvidence(response.evidence());
        result.setPayload(response.payload());           // AES 암호화 Converter 자동 적용
        result.setResponseSnippet(response.responseSnippet()); // AES 암호화 Converter 자동 적용
        result.setContainerId(response.containerId());
        result.setStatus(response.success() ? ScanStatus.SUCCESS : ScanStatus.FAILED);
    }

    private void publishToRedis(UUID sessionId, UUID vulnId, DastExecuteResponse response) {
        String channel = REDIS_CHANNEL_PREFIX + sessionId;
        Map<String, Object> message = Map.of(
                "type", "dast_result",
                "vulnId", vulnId.toString(),
                "success", response.success(),
                "evidence", response.evidence() != null ? response.evidence() : ""
        );

        try {
            String payload = objectMapper.writeValueAsString(message);
            redisTemplate.convertAndSend(channel, payload);
            log.debug("DAST result published to Redis: channel={} vulnId={}", channel, vulnId);
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize DAST result for Redis publish: sessionId={} vulnId={}",
                    sessionId, vulnId);
        }
    }
}
