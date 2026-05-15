package io.secureai.backend.domain.dast.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DistributedLockServiceTest {

    @Mock
    private RedisTemplate<String, String> redisTemplate;

    @Mock
    private ValueOperations<String, String> valueOperations;

    private DistributedLockService lockService;

    @BeforeEach
    void setUp() {
        // lenient: release() 테스트는 opsForValue()를 호출하지 않으므로 불필요 스텁 경고 방지
        lenient().when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        lockService = new DistributedLockService(redisTemplate);
    }

    @Test
    @DisplayName("tryAcquire - Redis SETNX 성공 시 true 반환")
    void tryAcquire_whenSetIfAbsentReturnsTrue_returnsTrue() {
        // given
        String domain = "example.com";
        when(valueOperations.setIfAbsent(
                eq("secureai:dast:lock:" + domain),
                eq("1"),
                eq(Duration.ofSeconds(300))
        )).thenReturn(true);

        // when
        boolean result = lockService.tryAcquire(domain);

        // then
        assertThat(result).isTrue();
    }

    @Test
    @DisplayName("tryAcquire - 락 이미 존재 시 false 반환")
    void tryAcquire_whenLockAlreadyExists_returnsFalse() {
        // given
        String domain = "example.com";
        when(valueOperations.setIfAbsent(anyString(), anyString(), any(Duration.class)))
                .thenReturn(false);

        // when
        boolean result = lockService.tryAcquire(domain);

        // then
        assertThat(result).isFalse();
    }

    @Test
    @DisplayName("tryAcquire - Redis 반환값 null 시 false 반환")
    void tryAcquire_whenSetIfAbsentReturnsNull_returnsFalse() {
        // given
        String domain = "example.com";
        when(valueOperations.setIfAbsent(anyString(), anyString(), any(Duration.class)))
                .thenReturn(null);

        // when
        boolean result = lockService.tryAcquire(domain);

        // then
        assertThat(result).isFalse();
    }

    @Test
    @DisplayName("release - Redis delete 호출로 락 해제")
    void release_deletesLockKey() {
        // given
        String domain = "example.com";
        String expectedKey = "secureai:dast:lock:" + domain;

        // when
        lockService.release(domain);

        // then
        verify(redisTemplate).delete(expectedKey);
    }

    @Test
    @DisplayName("tryAcquire - TTL 300초로 설정됨을 검증")
    void tryAcquire_setsTtlTo300Seconds() {
        // given
        String domain = "secure.example.com";
        when(valueOperations.setIfAbsent(anyString(), anyString(), any(Duration.class)))
                .thenReturn(true);

        // when
        lockService.tryAcquire(domain);

        // then
        verify(valueOperations).setIfAbsent(
                anyString(),
                anyString(),
                eq(Duration.ofSeconds(300))
        );
    }
}
