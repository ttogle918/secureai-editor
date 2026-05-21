package io.secureai.backend.domain.cleanup.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 파티션 유지보수 Job.
 * 매월 28일 새벽 4시에 실행되어 다음 달 파티션을 미리 생성한다.
 *
 * 현재는 analysis_progress_log 파티션 구조가 확정되지 않아 로그만 남긴다.
 * 프로덕션 배포 시 테이블 구조 확정 후 실제 SQL을 추가한다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PartitionMaintenanceJob {

    private final JdbcTemplate jdbcTemplate;

    @Scheduled(cron = "0 0 4 28 * *")
    @SchedulerLock(name = "partitionMaintenanceJob", lockAtMostFor = "PT30M", lockAtLeastFor = "PT5M")
    public void createNextMonthPartition() {
        log.info("[partition] 다음 달 파티션 유지보수 실행");
        // TODO: analysis_progress_log 파티션 구조 확정 후 파티션 생성 SQL 추가
        log.info("[partition] 완료");
    }
}
