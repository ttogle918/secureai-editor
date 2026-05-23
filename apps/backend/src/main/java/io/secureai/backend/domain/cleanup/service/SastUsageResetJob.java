package io.secureai.backend.domain.cleanup.service;

import io.secureai.backend.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * 월간 SAST 사용량 리셋 Job.
 * 매월 1일 자정에 실행되어 모든 사용자의 sast_usage_this_month를 0으로 초기화한다.
 *
 * UserRepository.resetMonthlySastUsage()는 네이티브 쿼리로
 * sast_usage_this_month = 0, sast_usage_reset_at = 다음 달 1일 로 설정한다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SastUsageResetJob {

    private final UserRepository userRepository;

    @Scheduled(cron = "0 0 0 1 * *")
    @SchedulerLock(name = "sastUsageResetJob", lockAtMostFor = "PT30M", lockAtLeastFor = "PT5M")
    @Transactional
    public void resetMonthlyUsage() {
        int updated = userRepository.resetMonthlySastUsage();
        log.info("[sast-reset] 월간 사용량 리셋 완료 — {}명", updated);
    }
}
