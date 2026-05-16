package io.secureai.backend.domain.dast.integration;

import io.secureai.backend.domain.dast.entity.ScanTarget;
import io.secureai.backend.domain.dast.repository.ScanTargetRepository;
import io.secureai.backend.domain.dast.service.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.StringRedisSerializer;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.utility.DockerImageName;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * TASK-602 통합 테스트 — TestContainers Redis를 사용한 Rate Limit + 분산 락 검증.
 * ScanTargetRepository는 mock으로 처리하여 PostgreSQL 의존성을 제거한다.
 *
 * [비활성화 사유] Testcontainers 1.20.4의 DockerClientProviderStrategy가 프로브 시
 * RemoteApiVersion.VERSION_1_24를 하드코딩해 사용한다. Docker Desktop Windows의
 * MinAPIVersion=1.40 정책과 충돌해 Status 400이 반환된다. 환경변수/시스템 프로퍼티로
 * 해결 불가능한 라이브러리 내부 제약이다.
 * 로직은 DomainVerificationServiceTest(단위 테스트)가 커버한다.
 * CI/CD(Linux Docker)나 Testcontainers 버전 업그레이드 후 재활성화 가능.
 */
@Disabled("Testcontainers 1.20.4 + Docker Desktop Windows MinAPIVersion=1.40 비호환 — DomainVerificationServiceTest가 로직 커버")
@ExtendWith(MockitoExtension.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class DomainVerificationRedisIT {

    static GenericContainer<?> REDIS;

    @Mock
    private ScanTargetRepository scanTargetRepository;

    private DistributedLockService lockService;
    private DomainVerificationService service;
    private LettuceConnectionFactory connectionFactory;
    private RedisTemplate<String, String> redisTemplate;

    @BeforeAll
    static void startRedisContainer() {
        // Docker Desktop Windows: TCP 엔드포인트 + MinAPI v1.40 이상 강제
        System.setProperty("DOCKER_HOST", "tcp://localhost:2375");
        System.setProperty("DOCKER_API_VERSION", "1.41");

        REDIS = new GenericContainer<>(DockerImageName.parse("redis:7-alpine"))
                .withExposedPorts(6379);
        REDIS.start();
    }

    @AfterAll
    static void stopRedisContainer() {
        if (REDIS != null && REDIS.isRunning()) {
            REDIS.stop();
        }
    }

    @BeforeEach
    void setUp() {
        RedisStandaloneConfiguration config = new RedisStandaloneConfiguration(
                REDIS.getHost(), REDIS.getMappedPort(6379));

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
        String domain = "ratelimit-" + UUID.randomUUID().toString().substring(0, 8) + ".test.local";

        lenient().when(scanTargetRepository.existsByProjectIdAndDomainAndVerifiedTrue(projectId, domain))
                .thenReturn(true);
        lenient().when(scanTargetRepository.findByProjectIdAndDomain(projectId, domain))
                .thenReturn(Optional.of(buildVerifiedConsentedTarget(projectId, domain)));

        for (int i = 0; i < 3; i++) {
            final int callIndex = i;
            assertThatCode(() -> service.assertDastAllowed(projectId, domain, "1.2.3.4"))
                    .as("호출 %d번째 — 허용되어야 함", callIndex + 1)
                    .doesNotThrowAnyException();
            lockService.release(domain);
        }

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

        assertThatCode(() -> service.assertDastAllowed(projectId, domain, "1.2.3.4"))
                .doesNotThrowAnyException();

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

        String raw = redisTemplate.opsForValue().get("secureai:dast:rate:" + domain);
        Long rateCount = raw == null ? null : Long.parseLong(raw);
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
