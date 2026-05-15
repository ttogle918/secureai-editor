package io.secureai.backend.domain.dast.integration;

import io.secureai.backend.domain.dast.entity.ScanTarget;
import io.secureai.backend.domain.dast.repository.ScanTargetRepository;
import io.secureai.backend.domain.dast.service.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.connection.RedisPassword;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.StringRedisSerializer;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * TASK-602 통합 테스트 — 실행 중인 Redis(localhost:6379)를 사용한 Rate Limit + 분산 락 검증.
 * ScanTargetRepository는 mock으로 처리하여 PostgreSQL 의존성을 제거한다.
 *
 * 사전 조건: make infra 또는 docker compose up redis 가 실행 중이어야 한다.
 */
@ExtendWith(MockitoExtension.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class DomainVerificationRedisIT {

    @Mock
    private ScanTargetRepository scanTargetRepository;

    private DistributedLockService lockService;
    private DomainVerificationService service;
    private LettuceConnectionFactory connectionFactory;
    private RedisTemplate<String, String> redisTemplate;

    @BeforeEach
    void setUp() {
        String host = System.getenv().getOrDefault("REDIS_TEST_HOST", "localhost");
        int port = Integer.parseInt(System.getenv().getOrDefault("REDIS_TEST_PORT", "6379"));
        String password = System.getenv().getOrDefault("REDIS_PASSWORD", "");

        RedisStandaloneConfiguration config = new RedisStandaloneConfiguration(host, port);
        if (!password.isBlank()) {
            config.setPassword(RedisPassword.of(password));
        }

        connectionFactory = new LettuceConnectionFactory(config);
        connectionFactory.afterPropertiesSet();

        redisTemplate = new RedisTemplate<>();
        redisTemplate.setConnectionFactory(connectionFactory);
        redisTemplate.setKeySerializer(new StringRedisSerializer());
        redisTemplate.setValueSerializer(new StringRedisSerializer());
        redisTemplate.afterPropertiesSet();

        lockService = new DistributedLockService(redisTemplate);
        service = new DomainVerificationService(scanTargetRepository, lockService, redisTemplate);
    }

    @AfterEach
    void tearDown() {
        connectionFactory.destroy();
    }

    // ── Rate Limit ────────────────────────────────────────────────────────────

    @Test
    @Order(1)
    @DisplayName("🔬 실제 Redis - 1시간 내 3회 허용, 4번째 호출 시 RateLimitExceededException(429)")
    void assertDastAllowed_realRedis_3allowedThen4thThrows429() {
        UUID projectId = UUID.randomUUID();
        // 고유 도메인으로 다른 테스트 Rate Limit 키와 충돌 방지
        String domain = "ratelimit-" + UUID.randomUUID().toString().substring(0, 8) + ".test.local";

        lenient().when(scanTargetRepository.existsByProjectIdAndDomainAndVerifiedTrue(projectId, domain))
                .thenReturn(true);
        lenient().when(scanTargetRepository.findByProjectIdAndDomain(projectId, domain))
                .thenReturn(Optional.of(buildVerifiedConsentedTarget(projectId, domain)));

        // 3회 성공 (각 호출 후 락 해제로 409 방지)
        for (int i = 0; i < 3; i++) {
            final int callIndex = i;
            assertThatCode(() -> service.assertDastAllowed(projectId, domain, "1.2.3.4"))
                    .as("호출 %d번째 — 허용되어야 함", callIndex + 1)
                    .doesNotThrowAnyException();
            lockService.release(domain);
        }

        // 4번째 → RateLimitExceededException (HTTP 429)
        assertThatThrownBy(() -> service.assertDastAllowed(projectId, domain, "1.2.3.4"))
                .isInstanceOf(RateLimitExceededException.class);
    }

    // ── 분산 락 (Concurrent Scan) ─────────────────────────────────────────────

    @Test
    @Order(2)
    @DisplayName("🔬 실제 Redis - 동일 도메인 동시 DAST 2회 → 두 번째 ConcurrentScanException(409)")
    void assertDastAllowed_realRedis_secondConcurrentCallThrows409() {
        UUID projectId = UUID.randomUUID();
        String domain = "concurrent-" + UUID.randomUUID().toString().substring(0, 8) + ".test.local";

        lenient().when(scanTargetRepository.existsByProjectIdAndDomainAndVerifiedTrue(projectId, domain))
                .thenReturn(true);
        lenient().when(scanTargetRepository.findByProjectIdAndDomain(projectId, domain))
                .thenReturn(Optional.of(buildVerifiedConsentedTarget(projectId, domain)));

        // 첫 번째 — 락 획득 성공 (락 유지)
        assertThatCode(() -> service.assertDastAllowed(projectId, domain, "1.2.3.4"))
                .doesNotThrowAnyException();

        // 두 번째 — 락이 이미 존재 → ConcurrentScanException (HTTP 409)
        assertThatThrownBy(() -> service.assertDastAllowed(projectId, domain, "1.2.3.4"))
                .isInstanceOf(ConcurrentScanException.class);

        lockService.release(domain);
    }

    @Test
    @Order(3)
    @DisplayName("🔬 실제 Redis - 락 해제 후 재요청 허용")
    void assertDastAllowed_realRedis_afterReleaseLockCanBeReacquired() {
        UUID projectId = UUID.randomUUID();
        String domain = "reacquire-" + UUID.randomUUID().toString().substring(0, 8) + ".test.local";

        lenient().when(scanTargetRepository.existsByProjectIdAndDomainAndVerifiedTrue(projectId, domain))
                .thenReturn(true);
        lenient().when(scanTargetRepository.findByProjectIdAndDomain(projectId, domain))
                .thenReturn(Optional.of(buildVerifiedConsentedTarget(projectId, domain)));

        service.assertDastAllowed(projectId, domain, "1.2.3.4");
        lockService.release(domain);

        // 락 해제 후 재호출 — Rate Limit 2/3이므로 허용
        assertThatCode(() -> service.assertDastAllowed(projectId, domain, "1.2.3.4"))
                .doesNotThrowAnyException();
        lockService.release(domain);
    }

    // ── 면책 동의 미체크 ───────────────────────────────────────────────────────

    @Test
    @Order(4)
    @DisplayName("🛡️ 면책 동의 미체크 시 ConsentRequiredException — Rate Limit 카운터 증가 없음")
    void assertDastAllowed_whenConsentNotGiven_doesNotIncrementRateCounter() {
        UUID projectId = UUID.randomUUID();
        String domain = "no-consent-" + UUID.randomUUID().toString().substring(0, 8) + ".test.local";

        when(scanTargetRepository.existsByProjectIdAndDomainAndVerifiedTrue(projectId, domain))
                .thenReturn(true);

        ScanTarget noConsent = ScanTarget.builder()
                .projectId(projectId)
                .domain(domain)
                .verificationToken("token")
                .build();
        noConsent.markVerified();
        when(scanTargetRepository.findByProjectIdAndDomain(projectId, domain))
                .thenReturn(Optional.of(noConsent));

        assertThatThrownBy(() -> service.assertDastAllowed(projectId, domain, "1.2.3.4"))
                .isInstanceOf(ConsentRequiredException.class);

        // 동의 차단이 Rate Limit보다 먼저 실행 → 카운터 미증가
        Long rateCount = redisTemplate.opsForValue().get("secureai:dast:rate:" + domain) == null
                ? null
                : Long.parseLong(redisTemplate.opsForValue().get("secureai:dast:rate:" + domain));
        assertThat(rateCount).as("동의 차단 시 Rate Limit 카운터가 증가하면 안 됨").isNull();
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private ScanTarget buildVerifiedConsentedTarget(UUID projectId, String domain) {
        ScanTarget target = ScanTarget.builder()
                .projectId(projectId)
                .domain(domain)
                .verificationToken("token")
                .build();
        target.markVerified();
        target.recordConsent("192.168.1.1");
        return target;
    }
}
