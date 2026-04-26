package io.secureai.backend.domain.analysis.service;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RedisPublisher {

    private static final String CHANNEL_PREFIX = "secureai:progress:";
    private final RedisTemplate<String, String> redisTemplate;

    public void publish(UUID sessionId, String jsonPayload) {
        redisTemplate.convertAndSend(CHANNEL_PREFIX + sessionId, jsonPayload);
    }
}
