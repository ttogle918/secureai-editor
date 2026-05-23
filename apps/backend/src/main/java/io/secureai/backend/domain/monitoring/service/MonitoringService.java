package io.secureai.backend.domain.monitoring.service;

import io.netty.channel.ChannelOption;
import io.secureai.backend.domain.dast.entity.ScanTarget;
import io.secureai.backend.domain.dast.repository.ScanTargetRepository;
import io.secureai.backend.domain.monitoring.entity.MonitoringResult;
import io.secureai.backend.domain.monitoring.entity.MonitoringStatus;
import io.secureai.backend.domain.monitoring.repository.MonitoringResultRepository;
import io.secureai.backend.domain.notification.service.SlackNotificationPort;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Mono;
import reactor.netty.http.client.HttpClient;

import java.time.Duration;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;

/**
 * 지속 모니터링 핵심 서비스.
 *
 * <p>SRP: HTTPS 헬스체크 + SSL 만료 파싱 + 결과 저장 + 알림 발송 오케스트레이션 담당.
 * SSRF 방어: {@code verified=true}인 도메인만 처리한다.
 * skip &amp; log: 개별 target 실패 시 나머지 처리를 계속한다.
 *
 * <p>[설계 주석] {@link io.secureai.backend.domain.dast.repository.ScanTargetRepository}를
 * 직접 주입받는다. 이는 ExpiredDataCleanupJob 패턴과 동일한 예외 케이스이다:
 * 모니터링은 스케줄 기반 인프라 컴포넌트로서 dast 도메인의 verified 목록을
 * 읽기 전용으로만 참조하며, dast 도메인의 비즈니스 로직(상태 전이·검증)을 수행하지 않는다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MonitoringService {

    private static final int SSL_EXPIRY_ALERT_DAYS = 30;
    private static final int WEBCLIENT_TIMEOUT_SECONDS = 10;
    private static final int WEBCLIENT_CONNECT_TIMEOUT_MILLIS = 5_000;

    private final ScanTargetRepository scanTargetRepository;
    private final MonitoringResultRepository monitoringResultRepository;
    private final SlackNotificationPort slackNotificationPort;
    private final SslCertChecker sslCertChecker;

    private WebClient webClient;

    @PostConstruct
    void initWebClient() {
        HttpClient httpClient = HttpClient.create()
                .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, WEBCLIENT_CONNECT_TIMEOUT_MILLIS)
                .responseTimeout(Duration.ofSeconds(WEBCLIENT_TIMEOUT_SECONDS));
        this.webClient = WebClient.builder()
                .clientConnector(new ReactorClientHttpConnector(httpClient))
                .build();
    }

    /**
     * verified=true인 모든 ScanTarget에 대해 헬스체크를 수행한다.
     * 개별 target 처리 실패 시 skip & log하고 나머지는 계속 처리한다.
     */
    public void checkAllTargets() {
        List<ScanTarget> targets = scanTargetRepository.findByVerifiedTrue();
        log.info("[monitoring] 헬스체크 시작 — 대상 수={}", targets.size());

        for (ScanTarget target : targets) {
            try {
                checkTarget(target);
            } catch (Exception e) {
                log.error("[monitoring] target 처리 중 예외 발생 — skip domain={} error={}",
                        target.getDomain(), e.getMessage());
            }
        }

        log.info("[monitoring] 헬스체크 완료 — 대상 수={}", targets.size());
    }

    /**
     * 단일 ScanTarget에 대해 HTTPS 헬스체크 + SSL 만료 확인을 수행하고 결과를 저장한다.
     */
    public void checkTarget(ScanTarget target) {
        String url = "https://" + target.getDomain();
        OffsetDateTime checkedAt = OffsetDateTime.now();
        long startMs = System.currentTimeMillis();

        try {
            Integer httpStatusCode = performHttpCheck(url);
            long responseTimeMs = System.currentTimeMillis() - startMs;

            Optional<LocalDate> sslExpiry = sslCertChecker.checkSsl(url);
            MonitoringStatus status = resolveStatus(sslExpiry);
            Integer sslDaysRemaining = sslExpiry.map(d -> (int) ChronoUnit.DAYS.between(LocalDate.now(), d))
                    .orElse(null);
            OffsetDateTime sslExpiresAt = sslExpiry
                    .map(d -> d.atStartOfDay(ZoneId.systemDefault()).toOffsetDateTime())
                    .orElse(null);

            MonitoringResult result = MonitoringResult.builder()
                    .scanTargetId(target.getId())
                    .projectId(target.getProjectId())
                    .status(status)
                    .httpStatusCode(httpStatusCode)
                    .responseTimeMs(responseTimeMs)
                    .sslExpiresAt(sslExpiresAt)
                    .sslDaysRemaining(sslDaysRemaining)
                    .checkedAt(checkedAt)
                    .build();

            monitoringResultRepository.save(result);

            if (sslDaysRemaining != null && sslDaysRemaining <= SSL_EXPIRY_ALERT_DAYS) {
                slackNotificationPort.sendSslExpiryAlert(target.getDomain(), sslDaysRemaining);
            }

            log.debug("[monitoring] 체크 완료 domain={} status={} responseMs={}",
                    target.getDomain(), status, responseTimeMs);

        } catch (Exception e) {
            long responseTimeMs = System.currentTimeMillis() - startMs;
            log.warn("[monitoring] HTTP 연결 실패 domain={} reason={}", target.getDomain(), e.getMessage());

            MonitoringResult downResult = MonitoringResult.builder()
                    .scanTargetId(target.getId())
                    .projectId(target.getProjectId())
                    .status(MonitoringStatus.DOWN)
                    .responseTimeMs(responseTimeMs)
                    .errorMessage(e.getMessage())
                    .checkedAt(checkedAt)
                    .build();

            monitoringResultRepository.save(downResult);
            slackNotificationPort.sendMonitoringDownAlert(target.getDomain(), e.getMessage());
        }
    }

    private Integer performHttpCheck(String url) {
        return webClient.get()
                .uri(url)
                .retrieve()
                .toBodilessEntity()
                .map(response -> response.getStatusCode().value())
                .onErrorResume(WebClientResponseException.class,
                        e -> Mono.just(e.getStatusCode().value()))
                .block(Duration.ofSeconds(WEBCLIENT_TIMEOUT_SECONDS));
    }

    private MonitoringStatus resolveStatus(Optional<LocalDate> sslExpiry) {
        if (sslExpiry.isEmpty()) {
            return MonitoringStatus.UP;
        }
        long daysRemaining = ChronoUnit.DAYS.between(LocalDate.now(), sslExpiry.get());
        if (daysRemaining < 0) {
            return MonitoringStatus.SSL_EXPIRED;
        }
        if (daysRemaining <= SSL_EXPIRY_ALERT_DAYS) {
            return MonitoringStatus.SSL_EXPIRING;
        }
        return MonitoringStatus.UP;
    }
}
