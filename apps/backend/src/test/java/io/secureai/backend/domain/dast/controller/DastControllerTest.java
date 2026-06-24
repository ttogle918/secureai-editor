package io.secureai.backend.domain.dast.controller;

import io.secureai.backend.domain.dast.dto.DastBatchRequest;
import io.secureai.backend.domain.dast.dto.DastBatchTarget;
import io.secureai.backend.domain.dast.dto.DastExecuteRequest;
import io.secureai.backend.domain.dast.dto.DastExecuteResponse;
import io.secureai.backend.domain.dast.dto.DastStartRequest;
import io.secureai.backend.domain.dast.entity.ExploitResult;
import io.secureai.backend.domain.dast.entity.ScanStatus;
import io.secureai.backend.domain.dast.service.DastExecutionService;
import io.secureai.backend.domain.dast.service.DastResultQueryService;
import io.secureai.backend.domain.dast.service.DomainVerificationService;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * DastController 단위 테스트 — MockMvc 없이 컨트롤러 메서드를 직접 호출한다.
 * HTTP 레이어 검증은 InternalKeyAuthFilter 가 담당하므로 여기서는 제외한다.
 */
@ExtendWith(MockitoExtension.class)
class DastControllerTest {

    @Mock
    private DastExecutionService dastExecutionService;

    @Mock
    private DastResultQueryService dastResultQueryService;

    @Mock
    private DomainVerificationService domainVerificationService;

    private DastController controller;

    private static final UUID SESSION_ID = UUID.randomUUID();
    private static final UUID VULN_ID    = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        controller = new DastController(dastExecutionService, dastResultQueryService, domainVerificationService);
    }

    // ── 내부 엔드포인트 ───────────────────────────────────────────────────────

    @Test
    @DisplayName("executeInSandbox - 유효한 요청 시 DastExecutionService.execute() 호출 후 200 반환")
    void executeInSandbox_callsServiceAndReturns200() {
        // given
        DastExecuteRequest req = new DastExecuteRequest(
                UUID.randomUUID().toString(),
                VULN_ID.toString(), "SQL_INJECTION",
                "https://target.example.com", "/api/login", Map.of("id", "1")
        );
        DastExecuteResponse expected = new DastExecuteResponse(
                true, "1 OR 1=1", "Login bypassed", "200 OK", null, "containerAbc"
        );
        when(dastExecutionService.execute(req)).thenReturn(expected);

        // when
        ResponseEntity<DastExecuteResponse> response = controller.executeInSandbox(req);

        // then
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().success()).isTrue();
        verify(dastExecutionService).execute(req);
    }

    // ── 공개 엔드포인트: startDast ─────────────────────────────────────────────

    @Test
    @DisplayName("startDast - consentGiven=false 이면 BusinessException(DAST_CONSENT_REQUIRED) 발생")
    void startDast_whenConsentNotGiven_throwsBusinessException() {
        // given
        DastStartRequest req = buildStartRequest("example.com", false);
        MockHttpServletRequest httpReq = new MockHttpServletRequest();

        // when / then
        assertThatThrownBy(() -> controller.startDast(null, req, httpReq))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> {
                    BusinessException be = (BusinessException) ex;
                    assertThat(be.getErrorCode()).isEqualTo(ErrorCode.DAST_CONSENT_REQUIRED);
                });

        verify(domainVerificationService, never()).assertDastAllowed(any(), any(), any());
    }

    @Test
    @DisplayName("startDast - consentGiven=true 이면 assertDastAllowed 호출 후 202 반환")
    void startDast_whenConsentGiven_callsVerificationAndReturns202() {
        // given
        UUID userId = UUID.randomUUID();
        DastStartRequest req = buildStartRequest("example.com", true);
        MockHttpServletRequest httpReq = new MockHttpServletRequest();
        httpReq.setRemoteAddr("10.0.0.1");

        doNothing().when(domainVerificationService).assertDastAllowed(eq(userId), eq("example.com"), any());

        // when
        ResponseEntity<Void> response = controller.startDast(userId, req, httpReq);

        // then
        assertThat(response.getStatusCode().value()).isEqualTo(202);
        verify(domainVerificationService).assertDastAllowed(eq(userId), eq("example.com"), any());
    }

    @Test
    @DisplayName("startDast - DomainNotVerifiedException 발생 시 그대로 전파")
    void startDast_whenDomainNotVerified_propagatesException() {
        // given
        UUID userId = UUID.randomUUID();
        DastStartRequest req = buildStartRequest("example.com", true);
        MockHttpServletRequest httpReq = new MockHttpServletRequest();

        doThrow(new BusinessException(ErrorCode.DAST_DOMAIN_NOT_VERIFIED))
                .when(domainVerificationService).assertDastAllowed(any(), any(), any());

        // when / then
        assertThatThrownBy(() -> controller.startDast(userId, req, httpReq))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> {
                    BusinessException be = (BusinessException) ex;
                    assertThat(be.getErrorCode()).isEqualTo(ErrorCode.DAST_DOMAIN_NOT_VERIFIED);
                });
    }

    @Test
    @DisplayName("startDast - X-Forwarded-For 헤더 존재 시 첫 번째 IP 사용")
    void startDast_withXForwardedFor_usesFirstIp() {
        // given
        UUID userId = UUID.randomUUID();
        DastStartRequest req = buildStartRequest("example.com", true);
        MockHttpServletRequest httpReq = new MockHttpServletRequest();
        httpReq.addHeader("X-Forwarded-For", "203.0.113.10, 10.0.0.1");

        // when
        controller.startDast(userId, req, httpReq);

        // then: clientIp 는 로그에 출력하지 않으므로 전달값만 검증
        verify(domainVerificationService).assertDastAllowed(eq(userId), eq("example.com"), eq("203.0.113.10"));
    }

    // ── 결과 조회 ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("getResults - DastResultQueryService.getResultsBySessionId 결과를 ApiResponse 로 래핑하여 반환")
    void getResults_wrapsResultsInApiResponse() {
        // given
        ExploitResult result = ExploitResult.builder()
                .sessionId(SESSION_ID)
                .vulnId(VULN_ID)
                .vulnType("SQL_INJECTION")
                .targetUrl("encrypted")
                .status(ScanStatus.SUCCESS)
                .build();
        when(dastResultQueryService.getResultsBySessionId(SESSION_ID)).thenReturn(List.of(result));

        // when
        var response = controller.getResults(SESSION_ID);

        // then
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getData()).hasSize(1);
        assertThat(response.getBody().getData().get(0).vulnType()).isEqualTo("SQL_INJECTION");
    }

    @Test
    @DisplayName("getResults - 결과 없으면 빈 리스트 반환")
    void getResults_whenEmpty_returnsEmptyList() {
        // given
        when(dastResultQueryService.getResultsBySessionId(SESSION_ID)).thenReturn(List.of());

        // when
        var response = controller.getResults(SESSION_ID);

        // then
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().getData()).isEmpty();
    }

    // ── 공개 엔드포인트: startDastBatch ──────────────────────────────────────

    @Test
    @DisplayName("startDastBatch - consentGiven=false 이면 BusinessException(DAST_CONSENT_REQUIRED) 발생")
    void startDastBatch_whenConsentNotGiven_throwsBusinessException() {
        // given
        DastBatchRequest req = buildBatchRequest("example.com", false);
        MockHttpServletRequest httpReq = new MockHttpServletRequest();

        // when / then
        assertThatThrownBy(() -> controller.startDastBatch(null, req, httpReq))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> {
                    BusinessException be = (BusinessException) ex;
                    assertThat(be.getErrorCode()).isEqualTo(ErrorCode.DAST_CONSENT_REQUIRED);
                });

        verify(domainVerificationService, never()).assertDastAllowed(any(), any(), any());
        verify(dastExecutionService, never()).initiateBatchDastScan(any());
    }

    @Test
    @DisplayName("startDastBatch - consentGiven=true 이면 assertDastAllowed 호출 후 202 반환")
    void startDastBatch_whenConsentGiven_callsVerificationAndReturns202() {
        // given
        UUID userId = UUID.randomUUID();
        DastBatchRequest req = buildBatchRequest("example.com", true);
        MockHttpServletRequest httpReq = new MockHttpServletRequest();
        httpReq.setRemoteAddr("10.0.0.1");

        doNothing().when(domainVerificationService).assertDastAllowed(eq(userId), eq("example.com"), any());

        // when
        ResponseEntity<Void> response = controller.startDastBatch(userId, req, httpReq);

        // then
        assertThat(response.getStatusCode().value()).isEqualTo(202);
        verify(domainVerificationService).assertDastAllowed(eq(userId), eq("example.com"), any());
        verify(dastExecutionService).initiateBatchDastScan(req);
    }

    @Test
    @DisplayName("startDastBatch - localhost 도메인은 도메인 소유권 검증을 건너뛴다")
    void startDastBatch_whenLocalhostDomain_skipsVerification() {
        // given
        DastBatchRequest req = buildBatchRequest("localhost", true);
        MockHttpServletRequest httpReq = new MockHttpServletRequest();

        // when
        ResponseEntity<Void> response = controller.startDastBatch(null, req, httpReq);

        // then
        assertThat(response.getStatusCode().value()).isEqualTo(202);
        verify(domainVerificationService, never()).assertDastAllowed(any(), any(), any());
        verify(dastExecutionService).initiateBatchDastScan(req);
    }

    @Test
    @DisplayName("startDastBatch - DomainNotVerifiedException 발생 시 그대로 전파")
    void startDastBatch_whenDomainNotVerified_propagatesException() {
        // given
        UUID userId = UUID.randomUUID();
        DastBatchRequest req = buildBatchRequest("example.com", true);
        MockHttpServletRequest httpReq = new MockHttpServletRequest();

        doThrow(new BusinessException(ErrorCode.DAST_DOMAIN_NOT_VERIFIED))
                .when(domainVerificationService).assertDastAllowed(any(), any(), any());

        // when / then
        assertThatThrownBy(() -> controller.startDastBatch(userId, req, httpReq))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> {
                    BusinessException be = (BusinessException) ex;
                    assertThat(be.getErrorCode()).isEqualTo(ErrorCode.DAST_DOMAIN_NOT_VERIFIED);
                });
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private DastStartRequest buildStartRequest(String domain, boolean consent) {
        return new DastStartRequest(
                SESSION_ID, VULN_ID, domain, consent,
                "SQL_INJECTION", "https://target.example.com", "/api/login", Map.of()
        );
    }

    private DastBatchRequest buildBatchRequest(String domain, boolean consent) {
        DastBatchTarget target = new DastBatchTarget(
                VULN_ID, "SQL_INJECTION", "https://target.example.com", "/api/login", Map.of()
        );
        return new DastBatchRequest(SESSION_ID, domain, consent, List.of(target));
    }
}
