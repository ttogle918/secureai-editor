package io.secureai.backend.domain.dast.service;

import io.secureai.backend.domain.dast.entity.ScanTarget;
import io.secureai.backend.domain.dast.repository.ScanTargetRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DomainVerificationServiceTest {

    @Mock
    private ScanTargetRepository scanTargetRepository;

    @Mock
    private DistributedLockService distributedLockService;

    @Mock
    private RedisTemplate<String, String> redisTemplate;

    @Mock
    private ValueOperations<String, String> valueOperations;

    private DomainVerificationService service;

    private UUID projectId;
    private UUID scanTargetId;
    private String domain;

    @BeforeEach
    void setUp() {
        // lenient: 일부 테스트는 Redis에 도달하기 전에 예외를 던져 이 스텁이 불필요할 수 있음
        lenient().when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        service = new DomainVerificationService(scanTargetRepository, distributedLockService, redisTemplate);
        projectId = UUID.randomUUID();
        scanTargetId = UUID.randomUUID();
        domain = "example.com";
    }

    // ── initVerification ──────────────────────────────────────────────────────

    @Test
    @DisplayName("initVerification - 기존 ScanTarget이 없으면 신규 생성하여 저장")
    void initVerification_whenNoExisting_createsAndSaves() {
        // given
        when(scanTargetRepository.findByProjectIdAndDomain(projectId, domain))
                .thenReturn(Optional.empty());
        ScanTarget saved = ScanTarget.builder()
                .projectId(projectId)
                .domain(domain)
                .verificationToken("token123")
                .build();
        when(scanTargetRepository.save(any(ScanTarget.class))).thenReturn(saved);

        // when
        ScanTarget result = service.initVerification(projectId, domain);

        // then
        assertThat(result).isNotNull();
        assertThat(result.getDomain()).isEqualTo(domain);
        verify(scanTargetRepository).save(any(ScanTarget.class));
    }

    @Test
    @DisplayName("initVerification - 기존 ScanTarget이 있으면 재사용")
    void initVerification_whenExisting_returnsExisting() {
        // given
        ScanTarget existing = ScanTarget.builder()
                .projectId(projectId)
                .domain(domain)
                .verificationToken("existing-token")
                .build();
        when(scanTargetRepository.findByProjectIdAndDomain(projectId, domain))
                .thenReturn(Optional.of(existing));

        // when
        ScanTarget result = service.initVerification(projectId, domain);

        // then
        assertThat(result).isSameAs(existing);
        verify(scanTargetRepository, never()).save(any());
    }

    // ── assertDastAllowed ─────────────────────────────────────────────────────

    @Test
    @DisplayName("assertDastAllowed - 도메인 미인증 시 DomainNotVerifiedException 발생")
    void assertDastAllowed_whenDomainNotVerified_throwsDomainNotVerifiedException() {
        // given
        when(scanTargetRepository.existsByProjectIdAndDomainAndVerifiedTrue(projectId, domain))
                .thenReturn(false);

        // when / then
        assertThatThrownBy(() -> service.assertDastAllowed(projectId, domain, "1.2.3.4"))
                .isInstanceOf(DomainNotVerifiedException.class);
    }

    @Test
    @DisplayName("assertDastAllowed - 면책 동의 미수령 시 ConsentRequiredException 발생")
    void assertDastAllowed_whenConsentNotGiven_throwsConsentRequiredException() {
        // given
        when(scanTargetRepository.existsByProjectIdAndDomainAndVerifiedTrue(projectId, domain))
                .thenReturn(true);
        ScanTarget noConsent = ScanTarget.builder()
                .projectId(projectId)
                .domain(domain)
                .verificationToken("token")
                .build();
        when(scanTargetRepository.findByProjectIdAndDomain(projectId, domain))
                .thenReturn(Optional.of(noConsent));

        // when / then
        assertThatThrownBy(() -> service.assertDastAllowed(projectId, domain, "1.2.3.4"))
                .isInstanceOf(ConsentRequiredException.class);
    }

    @Test
    @DisplayName("assertDastAllowed - Rate Limit 초과 시 RateLimitExceededException 발생")
    void assertDastAllowed_whenRateLimitExceeded_throwsRateLimitExceededException() {
        // given
        when(scanTargetRepository.existsByProjectIdAndDomainAndVerifiedTrue(projectId, domain))
                .thenReturn(true);
        ScanTarget withConsent = buildVerifiedConsentedTarget();
        when(scanTargetRepository.findByProjectIdAndDomain(projectId, domain))
                .thenReturn(Optional.of(withConsent));
        // 4번째 호출 (3회 초과)
        when(valueOperations.increment(anyString())).thenReturn(4L);

        // when / then
        assertThatThrownBy(() -> service.assertDastAllowed(projectId, domain, "1.2.3.4"))
                .isInstanceOf(RateLimitExceededException.class);
    }

    @Test
    @DisplayName("assertDastAllowed - 분산 락 획득 실패 시 ConcurrentScanException 발생")
    void assertDastAllowed_whenLockNotAcquired_throwsConcurrentScanException() {
        // given
        when(scanTargetRepository.existsByProjectIdAndDomainAndVerifiedTrue(projectId, domain))
                .thenReturn(true);
        ScanTarget withConsent = buildVerifiedConsentedTarget();
        when(scanTargetRepository.findByProjectIdAndDomain(projectId, domain))
                .thenReturn(Optional.of(withConsent));
        when(valueOperations.increment(anyString())).thenReturn(1L);
        when(distributedLockService.tryAcquire(domain)).thenReturn(false);

        // when / then
        assertThatThrownBy(() -> service.assertDastAllowed(projectId, domain, "1.2.3.4"))
                .isInstanceOf(ConcurrentScanException.class);
    }

    @Test
    @DisplayName("assertDastAllowed - 모든 조건 충족 시 정상 통과")
    void assertDastAllowed_whenAllConditionsMet_doesNotThrow() {
        // given
        when(scanTargetRepository.existsByProjectIdAndDomainAndVerifiedTrue(projectId, domain))
                .thenReturn(true);
        ScanTarget withConsent = buildVerifiedConsentedTarget();
        when(scanTargetRepository.findByProjectIdAndDomain(projectId, domain))
                .thenReturn(Optional.of(withConsent));
        when(valueOperations.increment(anyString())).thenReturn(1L);
        when(distributedLockService.tryAcquire(domain)).thenReturn(true);

        // when / then
        assertThatCode(() -> service.assertDastAllowed(projectId, domain, "1.2.3.4"))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("assertDastAllowed - Rate Limit 첫 호출 시 TTL 설정")
    void assertDastAllowed_onFirstIncrement_setsTtl() {
        // given
        when(scanTargetRepository.existsByProjectIdAndDomainAndVerifiedTrue(projectId, domain))
                .thenReturn(true);
        ScanTarget withConsent = buildVerifiedConsentedTarget();
        when(scanTargetRepository.findByProjectIdAndDomain(projectId, domain))
                .thenReturn(Optional.of(withConsent));
        when(valueOperations.increment(anyString())).thenReturn(1L);
        when(distributedLockService.tryAcquire(domain)).thenReturn(true);

        // when
        service.assertDastAllowed(projectId, domain, "1.2.3.4");

        // then
        verify(redisTemplate).expire(anyString(), eq(java.time.Duration.ofSeconds(3600L)));
    }

    // ── ScanTarget 도메인 메서드 ───────────────────────────────────────────────

    @Test
    @DisplayName("ScanTarget.recordConsent - consentGiven=true, consentIp, consentGivenAt 설정")
    void scanTarget_recordConsent_setsConsentFields() {
        // given
        ScanTarget target = ScanTarget.builder()
                .projectId(projectId)
                .domain(domain)
                .verificationToken("token")
                .build();

        // when
        target.recordConsent("10.0.0.1");

        // then
        assertThat(target.isConsentGiven()).isTrue();
        assertThat(target.getConsentIp()).isEqualTo("10.0.0.1");
        assertThat(target.getConsentGivenAt()).isNotNull();
    }

    @Test
    @DisplayName("ScanTarget.markVerified - verified=true, verifiedAt 설정")
    void scanTarget_markVerified_setsVerifiedFields() {
        // given
        ScanTarget target = ScanTarget.builder()
                .projectId(projectId)
                .domain(domain)
                .verificationToken("token")
                .build();

        // when
        target.markVerified();

        // then
        assertThat(target.isVerified()).isTrue();
        assertThat(target.getVerifiedAt()).isNotNull();
    }

    @Test
    @DisplayName("ScanTarget 초기 상태 - verified=false, consentGiven=false")
    void scanTarget_initialState_isFalse() {
        // given / when
        ScanTarget target = ScanTarget.builder()
                .projectId(projectId)
                .domain(domain)
                .verificationToken("token")
                .build();

        // then
        assertThat(target.isVerified()).isFalse();
        assertThat(target.isConsentGiven()).isFalse();
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private ScanTarget buildVerifiedConsentedTarget() {
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
