package io.secureai.backend.domain.user.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * GDPR 하드 삭제 배치 스케줄러.
 *
 * <p>매일 새벽 4시에 소프트 삭제 후 30일이 경과한 계정을 완전 삭제한다.
 * ShedLock 으로 다중 인스턴스 환경에서 중복 실행을 방지한다.
 *
 * <p>실제 삭제 로직은 {@link GdprHardDeleteService}에 위임한다 (SRP).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class GdprHardDeleteJob {

    private final GdprHardDeleteService gdprHardDeleteService;

    @Scheduled(cron = "0 0 4 * * *")
    @SchedulerLock(name = "gdprHardDelete", lockAtMostFor = "PT30M", lockAtLeastFor = "PT5M")
    public void run() {
        log.info("[gdpr-hard-delete] Job 시작");
        gdprHardDeleteService.processExpiredAccounts();
        log.info("[gdpr-hard-delete] Job 완료");
    }
}
