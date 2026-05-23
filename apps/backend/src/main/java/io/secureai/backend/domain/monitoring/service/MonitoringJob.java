package io.secureai.backend.domain.monitoring.service;

import io.secureai.backend.infrastructure.metrics.MonitoringMetrics;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 지속 모니터링 스케줄 Job.
 *
 * <p>매시 정각 실행. ShedLock으로 다중 인스턴스 중복 실행을 방지한다.
 * lockAtMostFor=PT50M — 최대 50분 이내 완료 보장.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MonitoringJob {

    private final MonitoringService monitoringService;
    private final MonitoringMetrics monitoringMetrics;

    @Scheduled(cron = "0 0 * * * *")
    @SchedulerLock(name = "monitoringJob", lockAtMostFor = "PT50M", lockAtLeastFor = "PT5M")
    public void run() {
        log.info("[monitoring-job] 헬스체크 Job 시작");
        monitoringService.checkAllTargets();
        monitoringMetrics.increment();
        log.info("[monitoring-job] 헬스체크 Job 완료");
    }
}
