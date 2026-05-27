package io.secureai.backend.domain.scheduling.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 야간 자동 스캔 배치 스케줄러.
 *
 * <p>매일 UTC 16:00 (KST 01:00) 에 활성화된 프로젝트를 대상으로 SAST 분석을 수행한다.
 * ShedLock으로 다중 인스턴스 환경에서 중복 실행을 방지한다.
 *
 * <p>SRP: 실행 시점 결정만 담당한다. 실제 로직은 {@link NightlyScanService}에 위임한다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class NightlyScanJob {

    private final NightlyScanService nightlyScanService;

    @Scheduled(cron = "0 0 16 * * *")  // UTC 16:00 = KST 01:00
    @SchedulerLock(name = "nightlyScanJob", lockAtMostFor = "PT2H", lockAtLeastFor = "PT10M")
    public void runNightlyScan() {
        log.info("[nightly-scan] 야간 스캔 시작");
        nightlyScanService.scanActiveProjects();
        log.info("[nightly-scan] 야간 스캔 완료");
    }
}
