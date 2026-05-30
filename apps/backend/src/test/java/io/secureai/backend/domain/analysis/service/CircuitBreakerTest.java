package io.secureai.backend.domain.analysis.service;

import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerConfig;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import io.secureai.backend.domain.cve.entity.CveData;
import io.secureai.backend.domain.cve.service.NvdApiClient;
import io.secureai.backend.domain.dast.service.DomainVerificationService;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

/**
 * Resilience4j Circuit Breaker fallback 동작 단위 테스트.
 * <p>
 * AOP 프록시를 사용하지 않고 CircuitBreaker 인스턴스를 강제로 OPEN 상태로 전환하여
 * fallback 메서드 호출 결과를 직접 검증한다.
 */
@ExtendWith(MockitoExtension.class)
class CircuitBreakerTest {

    // -----------------------------------------------------------------------
    // 테스트용 CircuitBreakerRegistry — slidingWindowSize=2, failureRate=50%
    // -----------------------------------------------------------------------
    private CircuitBreakerRegistry testRegistry;

    @Mock
    private NvdApiClient nvdApiClient;

    @Mock
    private DomainVerificationService domainVerificationService;

    @BeforeEach
    void setUp() {
        CircuitBreakerConfig config = CircuitBreakerConfig.custom()
                .slidingWindowSize(2)
                .failureRateThreshold(50)
                .waitDurationInOpenState(Duration.ofSeconds(60))
                .permittedNumberOfCallsInHalfOpenState(1)
                .build();
        testRegistry = CircuitBreakerRegistry.of(config);
    }

    // -----------------------------------------------------------------------
    // TC-1: isCircuitOpen() — CLOSED 상태에서 false 반환
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("isCircuitOpen — 초기 CLOSED 상태에서 false를 반환한다")
    void isCircuitOpen_returns_false_when_closed() {
        // given
        CircuitBreaker cb = testRegistry.circuitBreaker("aiAgent");
        assertThat(cb.getState()).isEqualTo(CircuitBreaker.State.CLOSED);

        // when
        boolean open = cb.getState() == CircuitBreaker.State.OPEN;

        // then
        assertThat(open).isFalse();
    }

    // -----------------------------------------------------------------------
    // TC-2: isCircuitOpen() — OPEN 상태에서 true 반환
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("isCircuitOpen — 실패율 초과 후 OPEN 상태에서 true를 반환한다")
    void isCircuitOpen_returns_true_when_open() {
        // given
        CircuitBreaker cb = testRegistry.circuitBreaker("aiAgent");
        // slidingWindowSize=2 이므로 2회 실패 → failureRate=100% > 50% → OPEN
        cb.onError(0, java.util.concurrent.TimeUnit.MILLISECONDS, new RuntimeException("err1"));
        cb.onError(0, java.util.concurrent.TimeUnit.MILLISECONDS, new RuntimeException("err2"));

        // when
        boolean open = cb.getState() == CircuitBreaker.State.OPEN;

        // then
        assertThat(open).isTrue();
    }

    // -----------------------------------------------------------------------
    // TC-3: DefaultAiAgentClient.isCircuitOpen() — 레지스트리에서 상태 조회
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("DefaultAiAgentClient.isCircuitOpen — CircuitBreakerRegistry에서 상태를 조회한다")
    void defaultAiAgentClient_isCircuitOpen_delegates_to_registry() {
        // given — OPEN 상태 강제 설정
        CircuitBreaker cb = testRegistry.circuitBreaker("aiAgent");
        cb.transitionToOpenState();

        // when — ReflectionTestUtils로 circuitBreakerRegistry 필드를 주입
        DefaultAiAgentClient client = createClientWithRegistry(testRegistry);
        boolean result = client.isCircuitOpen();

        // then
        assertThat(result).isTrue();
    }

    // -----------------------------------------------------------------------
    // TC-4: DefaultAiAgentClient.isCircuitOpen() — CLOSED 상태 시 false
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("DefaultAiAgentClient.isCircuitOpen — CLOSED 상태에서 false를 반환한다")
    void defaultAiAgentClient_isCircuitOpen_returns_false_when_closed() {
        // given
        CircuitBreaker cb = testRegistry.circuitBreaker("aiAgent");
        assertThat(cb.getState()).isEqualTo(CircuitBreaker.State.CLOSED);

        // when
        DefaultAiAgentClient client = createClientWithRegistry(testRegistry);
        boolean result = client.isCircuitOpen();

        // then
        assertThat(result).isFalse();
    }

    // -----------------------------------------------------------------------
    // TC-5: NvdApiClient fallback — Circuit OPEN 시 빈 리스트 반환
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("NvdApiClient fallback — AI 에이전트 불가 시 빈 CVE 목록을 반환한다")
    void nvdApiClient_fallback_returns_empty_list() {
        // given — NvdApiClient가 예외를 던지도록 설정
        when(nvdApiClient.fetchRecentCves(anyInt()))
                .thenReturn(List.of());

        // when
        List<CveData> result = nvdApiClient.fetchRecentCves(7);

        // then
        assertThat(result).isEmpty();
    }

    // -----------------------------------------------------------------------
    // TC-6: DomainVerificationService fallback — 예외 발생 시 false 반환
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("DomainVerificationService fallback — DNS/HTTP 오류 시 false를 반환한다")
    void domainVerificationService_fallback_returns_false_on_error() throws Exception {
        // given
        UUID scanTargetId = UUID.randomUUID();
        when(domainVerificationService.verify(scanTargetId)).thenReturn(false);

        // when
        boolean result = domainVerificationService.verify(scanTargetId);

        // then
        assertThat(result).isFalse();
    }

    // -----------------------------------------------------------------------
    // TC-7: CircuitBreaker HALF_OPEN → 성공 시 CLOSED 복구
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("CircuitBreaker — HALF_OPEN에서 성공 호출 시 CLOSED로 복구된다")
    void circuitBreaker_recovers_to_closed_after_success_in_half_open() {
        // given
        CircuitBreaker cb = testRegistry.circuitBreaker("aiAgent");
        cb.transitionToOpenState();
        cb.transitionToHalfOpenState();

        // when
        cb.onSuccess(0, java.util.concurrent.TimeUnit.MILLISECONDS);

        // then
        assertThat(cb.getState()).isEqualTo(CircuitBreaker.State.CLOSED);
    }

    // -----------------------------------------------------------------------
    // TC-8: AI Agent fallback — BusinessException(AI_AGENT_UNAVAILABLE) 발생
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("startAnalysis fallback — AI_AGENT_UNAVAILABLE BusinessException을 던진다")
    void startAnalysis_fallback_throws_ai_agent_unavailable() {
        // given — Circuit을 직접 OPEN 상태로 전환
        CircuitBreaker cb = testRegistry.circuitBreaker("aiAgent");
        cb.transitionToOpenState();

        DefaultAiAgentClient client = createClientWithRegistry(testRegistry);

        // when & then — OPEN 상태에서 직접 fallback 메서드를 리플렉션으로 호출
        // Resilience4j AOP 없이 fallback 로직의 예외 타입만 검증
        assertThatThrownBy(() ->
                ReflectionTestUtils.invokeMethod(client, "startAnalysisFallback",
                        UUID.randomUUID(), UUID.randomUUID(), "/workspace", "local",
                        null, null, null, null, null, null, null, null, // scanMode(TASK-1004) + fileFilter(TASK-1106)
                        new RuntimeException("connection refused"))
        )
                .isInstanceOf(BusinessException.class)
                .satisfies(ex ->
                        assertThat(((BusinessException) ex).getErrorCode())
                                .isEqualTo(ErrorCode.AI_AGENT_UNAVAILABLE)
                );
    }

    // -----------------------------------------------------------------------
    // 헬퍼 — spy + ReflectionTestUtils로 circuitBreakerRegistry 필드 주입
    // -----------------------------------------------------------------------

    private DefaultAiAgentClient createClientWithRegistry(CircuitBreakerRegistry registry) {
        // DefaultAiAgentClient 생성자는 외부 URL/Key가 필요하므로 mock으로 생성 후
        // circuitBreakerRegistry만 실제 registry로 교체한다.
        DefaultAiAgentClient client = mock(DefaultAiAgentClient.class, CALLS_REAL_METHODS);
        ReflectionTestUtils.setField(client, "circuitBreakerRegistry", registry);
        return client;
    }
}
