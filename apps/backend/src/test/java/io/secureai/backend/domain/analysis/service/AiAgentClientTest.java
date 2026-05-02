package io.secureai.backend.domain.analysis.service;

import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestClient;

import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AiAgentClientTest {

    private DefaultAiAgentClient client;
    private RestClient.RequestBodyUriSpec uriSpec;
    private RestClient.RequestBodySpec bodySpec;
    private RestClient.ResponseSpec responseSpec;
    private RestClient restClient;

    @BeforeEach
    void setUp() {
        client = new DefaultAiAgentClient("http://localhost:8000", "test-key");

        // 내부 RestClient를 mock으로 교체
        restClient = mock(RestClient.class);
        uriSpec = mock(RestClient.RequestBodyUriSpec.class);
        bodySpec = mock(RestClient.RequestBodySpec.class);
        responseSpec = mock(RestClient.ResponseSpec.class);

        ReflectionTestUtils.setField(client, "restClient", restClient);
        ReflectionTestUtils.setField(client, "failureCount", 0);
        ReflectionTestUtils.setField(client, "circuitOpen", new AtomicBoolean(false));
        ReflectionTestUtils.setField(client, "circuitOpenTime", new AtomicLong(0L));
    }

    // -----------------------------------------------------------------------
    // TC-1: 연속 3회 실패 → circuitOpen = true
    // -----------------------------------------------------------------------

    @Test
    void circuitOpens_after_three_consecutive_failures() {
        when(restClient.post()).thenReturn(uriSpec);
        when(uriSpec.uri(anyString(), any(UUID.class))).thenReturn(bodySpec);
        when(bodySpec.retrieve()).thenReturn(responseSpec);
        when(responseSpec.toBodilessEntity())
                .thenThrow(new org.springframework.web.client.RestClientException("timeout"));

        UUID sessionId = UUID.randomUUID();
        for (int i = 0; i < 3; i++) {
            // 첫 2회: 실패 기록되지만 circuit은 아직 CLOSED
            try { client.resumeAnalysis(sessionId); } catch (BusinessException ignored) {}
        }

        assertThat(client.isCircuitOpen()).isTrue();
    }

    // -----------------------------------------------------------------------
    // TC-2: circuit OPEN 상태에서 호출 → 즉시 AI_AGENT_UNAVAILABLE
    // -----------------------------------------------------------------------

    @Test
    void circuitOpen_throws_immediately_without_calling_agent() {
        ReflectionTestUtils.setField(client, "circuitOpen", new AtomicBoolean(true));
        ReflectionTestUtils.setField(client, "circuitOpenTime",
                new AtomicLong(System.currentTimeMillis()));

        UUID sessionId = UUID.randomUUID();

        assertThatThrownBy(() -> client.startAnalysis(
                        sessionId, UUID.randomUUID(), "/ws", "local", null, null, null, null))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.AI_AGENT_UNAVAILABLE);

        // RestClient.post()가 호출되지 않아야 한다
        verifyNoInteractions(restClient);
    }

    // -----------------------------------------------------------------------
    // TC-3: OPEN 후 30초 경과 → HALF-OPEN → 성공 시 circuitOpen = false
    // -----------------------------------------------------------------------

    @Test
    void circuit_resets_to_closed_after_timeout_and_success() {
        // circuit을 OPEN 상태로, 개방 시각을 31초 전으로 설정
        ReflectionTestUtils.setField(client, "circuitOpen", new AtomicBoolean(true));
        ReflectionTestUtils.setField(client, "circuitOpenTime",
                new AtomicLong(System.currentTimeMillis() - 31_000L));

        when(restClient.post()).thenReturn(uriSpec);
        when(uriSpec.uri(anyString(), any(UUID.class))).thenReturn(bodySpec);
        when(bodySpec.retrieve()).thenReturn(responseSpec);
        when(responseSpec.toBodilessEntity()).thenReturn(null);

        UUID sessionId = UUID.randomUUID();
        client.resumeAnalysis(sessionId); // 성공 → CLOSED

        assertThat(client.isCircuitOpen()).isFalse();
    }

    // -----------------------------------------------------------------------
    // TC-4: github source_type으로 startAnalysis 호출 시 circuit이 CLOSED이면 성공
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("github source_type으로 startAnalysis 호출 시 circuit CLOSED이면 성공한다")
    void startAnalysis_github_source_type_succeeds_when_circuit_closed() {
        when(restClient.post()).thenReturn(uriSpec);
        when(uriSpec.uri(anyString())).thenReturn(bodySpec);
        // body()는 제네릭 메서드 — any(Object.class)로 명시적 타입 지정 필요
        when(bodySpec.body(any(Object.class))).thenReturn(bodySpec);
        when(bodySpec.retrieve()).thenReturn(responseSpec);
        when(responseSpec.toBodilessEntity()).thenReturn(null);

        UUID sessionId = UUID.randomUUID();
        UUID projectId = UUID.randomUUID();

        // 예외 없이 성공해야 한다
        assertThatCode(() -> client.startAnalysis(
                sessionId, projectId, null,
                "github", "myorg", "myrepo", "main", "ghp_token"))
                .doesNotThrowAnyException();

        assertThat(client.isCircuitOpen()).isFalse();
    }

    // -----------------------------------------------------------------------
    // TC-5: convenience 오버로드(workspaceRoot 단일 파라미터)가 정상 동작한다
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("convenience startAnalysis(3파라미터)도 circuit CLOSED이면 성공한다")
    void startAnalysis_convenience_overload_succeeds() {
        when(restClient.post()).thenReturn(uriSpec);
        when(uriSpec.uri(anyString())).thenReturn(bodySpec);
        when(bodySpec.body(any(Object.class))).thenReturn(bodySpec);
        when(bodySpec.retrieve()).thenReturn(responseSpec);
        when(responseSpec.toBodilessEntity()).thenReturn(null);

        UUID sessionId = UUID.randomUUID();
        UUID projectId = UUID.randomUUID();

        assertThatCode(() -> client.startAnalysis(sessionId, projectId, "/workspace/test"))
                .doesNotThrowAnyException();
    }
}
