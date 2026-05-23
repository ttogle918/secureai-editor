package io.secureai.backend.domain.monitoring;

import io.secureai.backend.domain.dast.entity.ScanTarget;
import io.secureai.backend.domain.dast.repository.ScanTargetRepository;
import io.secureai.backend.domain.monitoring.entity.MonitoringResult;
import io.secureai.backend.domain.monitoring.entity.MonitoringStatus;
import io.secureai.backend.domain.monitoring.repository.MonitoringResultRepository;
import io.secureai.backend.domain.monitoring.service.MonitoringService;
import io.secureai.backend.domain.monitoring.service.SslCertChecker;
import io.secureai.backend.domain.notification.service.SlackNotificationPort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MonitoringServiceTest {

    @Mock
    ScanTargetRepository scanTargetRepository;

    @Mock
    MonitoringResultRepository monitoringResultRepository;

    @Mock
    SlackNotificationPort slackNotificationPort;

    @Mock
    SslCertChecker sslCertChecker;

    @Mock
    WebClient webClient;

    MonitoringService monitoringService;

    private UUID targetId;
    private UUID projectId;

    @BeforeEach
    void setUp() {
        targetId = UUID.randomUUID();
        projectId = UUID.randomUUID();
        monitoringService = new MonitoringService(
                scanTargetRepository, monitoringResultRepository,
                slackNotificationPort, sslCertChecker);
        // @PostConstruct를 건너뛰고 mock WebClient를 직접 주입
        org.springframework.test.util.ReflectionTestUtils.setField(monitoringService, "webClient", webClient);
    }

    @Test
    @DisplayName("verified=false인 target은 체크 대상에서 제외된다")
    void checkAllTargets_verified대상만_포함된다() {
        // given: verified=true target 1개, verified=false는 findByVerifiedTrue()에 포함되지 않음
        ScanTarget verifiedTarget = ScanTarget.builder()
                .id(targetId)
                .projectId(projectId)
                .domain("verified.example.com")
                .verified(true)
                .verificationToken("token")
                .build();

        given(scanTargetRepository.findByVerifiedTrue()).willReturn(List.of(verifiedTarget));
        stubWebClientOkResponse();
        given(sslCertChecker.checkSsl(anyString())).willReturn(Optional.empty());
        given(monitoringResultRepository.save(any())).willAnswer(inv -> inv.getArgument(0));

        // when
        monitoringService.checkAllTargets();

        // then: findByVerifiedTrue()만 호출, 정확히 1건 저장
        verify(scanTargetRepository).findByVerifiedTrue();
        verify(monitoringResultRepository, times(1)).save(any());
    }

    @Test
    @DisplayName("HTTP 200 응답 시 status=UP으로 저장된다")
    void checkTarget_HTTP200_statusUP_저장() {
        // given
        ScanTarget target = buildVerifiedTarget("ok.example.com");
        stubWebClientOkResponse();
        given(sslCertChecker.checkSsl(anyString())).willReturn(Optional.empty());

        ArgumentCaptor<MonitoringResult> captor = ArgumentCaptor.forClass(MonitoringResult.class);
        given(monitoringResultRepository.save(captor.capture())).willAnswer(inv -> inv.getArgument(0));

        // when
        monitoringService.checkTarget(target);

        // then
        MonitoringResult saved = captor.getValue();
        assertThat(saved.getStatus()).isEqualTo(MonitoringStatus.UP);
        assertThat(saved.getHttpStatusCode()).isEqualTo(200);
        assertThat(saved.getScanTargetId()).isEqualTo(targetId);
    }

    @Test
    @DisplayName("HTTP 연결 실패 시 status=DOWN으로 저장되고 Slack DOWN 알림이 호출된다")
    void checkTarget_HTTP연결실패_statusDOWN_Slack알림() {
        // given
        ScanTarget target = buildVerifiedTarget("down.example.com");
        stubWebClientConnectionError();

        ArgumentCaptor<MonitoringResult> captor = ArgumentCaptor.forClass(MonitoringResult.class);
        given(monitoringResultRepository.save(captor.capture())).willAnswer(inv -> inv.getArgument(0));

        // when
        monitoringService.checkTarget(target);

        // then
        MonitoringResult saved = captor.getValue();
        assertThat(saved.getStatus()).isEqualTo(MonitoringStatus.DOWN);
        assertThat(saved.getErrorMessage()).isNotNull();
        verify(slackNotificationPort).sendMonitoringDownAlert(eq("down.example.com"), anyString());
    }

    @Test
    @DisplayName("SSL 만료 30일 이내일 때 sendSslExpiryAlert가 호출된다")
    void checkTarget_SSL만료30일이내_SslExpiryAlert호출() {
        // given
        ScanTarget target = buildVerifiedTarget("expiring.example.com");
        stubWebClientOkResponse();

        LocalDate nearExpiry = LocalDate.now().plusDays(10);
        given(sslCertChecker.checkSsl(anyString())).willReturn(Optional.of(nearExpiry));
        given(monitoringResultRepository.save(any())).willAnswer(inv -> inv.getArgument(0));

        // when
        monitoringService.checkTarget(target);

        // then
        verify(slackNotificationPort).sendSslExpiryAlert(eq("expiring.example.com"), eq(10));
    }

    @Test
    @DisplayName("개별 target에서 예외 발생 시 나머지 target 처리가 계속된다")
    void checkAllTargets_개별실패_나머지계속처리() {
        // given: 첫 번째 target은 checkTarget 내에서 RuntimeException, 두 번째는 정상
        ScanTarget failTarget = buildVerifiedTarget("fail.example.com");
        UUID okTargetId = UUID.randomUUID();
        ScanTarget okTarget = ScanTarget.builder()
                .id(okTargetId)
                .projectId(projectId)
                .domain("ok.example.com")
                .verified(true)
                .verificationToken("token")
                .build();

        given(scanTargetRepository.findByVerifiedTrue()).willReturn(List.of(failTarget, okTarget));

        // WebClient.get()을 호출하면 첫 번째는 예외, 두 번째는 정상 응답
        WebClient.RequestHeadersUriSpec uriSpec2 = mock(WebClient.RequestHeadersUriSpec.class);
        WebClient.RequestHeadersSpec headersSpec2 = mock(WebClient.RequestHeadersSpec.class);
        WebClient.ResponseSpec respSpec2 = mock(WebClient.ResponseSpec.class);

        given(webClient.get())
                .willThrow(new RuntimeException("네트워크 오류"))  // fail.example.com
                .willReturn(uriSpec2);                             // ok.example.com

        given(uriSpec2.uri(anyString())).willReturn(headersSpec2);
        given(headersSpec2.retrieve()).willReturn(respSpec2);
        org.springframework.http.ResponseEntity<Void> okResp =
                org.springframework.http.ResponseEntity.ok().build();
        given(respSpec2.toBodilessEntity()).willReturn(Mono.just(okResp));
        given(sslCertChecker.checkSsl(anyString())).willReturn(Optional.empty());
        given(monitoringResultRepository.save(any())).willAnswer(inv -> inv.getArgument(0));

        // when — 전체 실패 없이 완료되어야 함
        org.junit.jupiter.api.Assertions.assertDoesNotThrow(
                () -> monitoringService.checkAllTargets()
        );

        // then: 두 번째 target은 정상 처리되어 save 호출됨
        verify(monitoringResultRepository, atLeastOnce()).save(any());
    }

    // ── 헬퍼 메서드 ──────────────────────────────────────────────────

    private ScanTarget buildVerifiedTarget(String domain) {
        return ScanTarget.builder()
                .id(targetId)
                .projectId(projectId)
                .domain(domain)
                .verified(true)
                .verificationToken("token")
                .build();
    }

    @SuppressWarnings("unchecked")
    private void stubWebClientOkResponse() {
        WebClient.RequestHeadersUriSpec uriSpec = mock(WebClient.RequestHeadersUriSpec.class);
        WebClient.RequestHeadersSpec headersSpec = mock(WebClient.RequestHeadersSpec.class);
        WebClient.ResponseSpec respSpec = mock(WebClient.ResponseSpec.class);

        given(webClient.get()).willReturn(uriSpec);
        given(uriSpec.uri(anyString())).willReturn(headersSpec);
        given(headersSpec.retrieve()).willReturn(respSpec);

        org.springframework.http.ResponseEntity<Void> responseEntity =
                org.springframework.http.ResponseEntity.ok().build();
        given(respSpec.toBodilessEntity())
                .willReturn(Mono.just(responseEntity));
    }

    @SuppressWarnings("unchecked")
    private void stubWebClientConnectionError() {
        WebClient.RequestHeadersUriSpec uriSpec = mock(WebClient.RequestHeadersUriSpec.class);
        WebClient.RequestHeadersSpec headersSpec = mock(WebClient.RequestHeadersSpec.class);
        WebClient.ResponseSpec respSpec = mock(WebClient.ResponseSpec.class);

        given(webClient.get()).willReturn(uriSpec);
        given(uriSpec.uri(anyString())).willReturn(headersSpec);
        given(headersSpec.retrieve()).willReturn(respSpec);

        given(respSpec.toBodilessEntity())
                .willReturn(Mono.error(new java.net.ConnectException("Connection refused")));
    }
}
