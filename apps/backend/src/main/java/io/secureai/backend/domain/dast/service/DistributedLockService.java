package io.secureai.backend.domain.dast.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;

/**
 * Redis SETNX 기반 분산 락 서비스.
 * DAST 실행 중 동일 도메인에 대한 중복 스캔을 방지한다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DistributedLockService {

    private static final String LOCK_KEY_PREFIX = "secureai:dast:lock:";
    private static final Duration LOCK_TTL = Duration.ofSeconds(300);
    private static final String LOCK_VALUE = "1";

    private final RedisTemplate<String, String> redisTemplate;

    /**
     * 도메인에 대한 분산 락 획득을 시도한다.
     * TTL은 300초(DAST 최대 실행 시간)로 설정된다.
     *
     * @param domain 스캔 대상 도메인
     * @return 락 획득 성공 시 true, 이미 락이 존재하면 false
     */
    public boolean tryAcquire(String domain) {
        String key = buildLockKey(domain);
        Boolean acquired = redisTemplate.opsForValue().setIfAbsent(key, LOCK_VALUE, LOCK_TTL);
        boolean result = Boolean.TRUE.equals(acquired);
        if (!result) {
            log.debug("Distributed lock already held for domain={}", domain);
        }
        return result;
    }

    /**
     * 도메인에 대한 분산 락을 해제한다.
     * DAST 완료 또는 오류 발생 시 반드시 호출해야 한다.
     *
     * @param domain 스캔 대상 도메인
     */
    public void release(String domain) {
        String key = buildLockKey(domain);
        redisTemplate.delete(key);
        log.debug("Distributed lock released for domain={}", domain);
    }

    private String buildLockKey(String domain) {
        return LOCK_KEY_PREFIX + domain;
    }
}
