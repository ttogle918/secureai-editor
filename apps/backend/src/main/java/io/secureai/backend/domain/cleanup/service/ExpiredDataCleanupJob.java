package io.secureai.backend.domain.cleanup.service;

import io.secureai.backend.domain.dast.repository.ExploitResultRepository;
import io.secureai.backend.domain.report.repository.ReportRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;

/**
 * 만료 데이터 정리 Job.
 * - exploit_results: 30일 초과 삭제
 * - reports: 90일 초과 삭제
 *
 * LangGraph checkpoint는 Python 측에서 관리하므로 여기서는 Spring 관리 데이터만 정리한다.
 *
 * [설계 주석] 이 Job은 스케줄 기반 인프라 정리 컴포넌트이므로
 * ApplicationEvent 패턴이 적용되지 않는다(이벤트 발행 주체 없음).
 * 대신 각 도메인 Repository를 직접 주입해 삭제 쿼리만 호출한다.
 * 비즈니스 로직(유효성 검증, 상태 전이)은 수행하지 않는다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ExpiredDataCleanupJob {

    private static final int EXPLOIT_RESULT_RETENTION_DAYS = 30;
    private static final int REPORT_RETENTION_DAYS = 90;

    private final ExploitResultRepository exploitResultRepository;
    private final ReportRepository reportRepository;

    @Scheduled(cron = "0 0 2 * * *")
    @SchedulerLock(name = "expiredDataCleanupJob", lockAtMostFor = "PT1H", lockAtLeastFor = "PT10M")
    @Transactional
    public void cleanupExpiredData() {
        OffsetDateTime exploitCutoff = OffsetDateTime.now().minusDays(EXPLOIT_RESULT_RETENTION_DAYS);
        OffsetDateTime reportCutoff = OffsetDateTime.now().minusDays(REPORT_RETENTION_DAYS);

        int deleted = exploitResultRepository.deleteByCreatedAtBefore(exploitCutoff);
        log.info("[cleanup] exploit_results {}건 삭제 ({}일 초과)", deleted, EXPLOIT_RESULT_RETENTION_DAYS);

        deleted = reportRepository.deleteByCreatedAtBefore(reportCutoff);
        log.info("[cleanup] reports {}건 삭제 ({}일 초과)", deleted, REPORT_RETENTION_DAYS);
    }
}
