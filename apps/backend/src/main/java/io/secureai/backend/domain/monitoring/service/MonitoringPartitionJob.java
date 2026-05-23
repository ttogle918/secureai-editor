package io.secureai.backend.domain.monitoring.service;

import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.regex.Pattern;

/**
 * monitoring_results 파티션 테이블 월별 자동 생성 Job.
 *
 * <p>매월 1일 오전 1시 실행. 다음 달 파티션을 미리 생성해
 * 파티션 누락으로 인한 INSERT 실패를 방지한다.
 *
 * <p>파티션 이름 형식: monitoring_results_YYYY_MM (ex: monitoring_results_2026_07)
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MonitoringPartitionJob {

    private static final DateTimeFormatter PARTITION_FMT = DateTimeFormatter.ofPattern("yyyy_MM");
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    private static final Pattern PARTITION_NAME_PATTERN = Pattern.compile("^monitoring_results_\\d{4}_\\d{2}$");
    private static final Pattern DATE_PATTERN = Pattern.compile("^\\d{4}-\\d{2}-\\d{2}$");

    private final EntityManager entityManager;

    @Scheduled(cron = "0 0 1 1 * *")
    @SchedulerLock(name = "monitoringPartitionJob", lockAtMostFor = "PT10M", lockAtLeastFor = "PT1M")
    @Transactional
    public void createNextMonthPartition() {
        YearMonth nextMonth = YearMonth.now().plusMonths(1);
        YearMonth monthAfter = nextMonth.plusMonths(1);

        String partitionName = "monitoring_results_" + nextMonth.format(PARTITION_FMT);
        String fromDate = nextMonth.atDay(1).format(DATE_FMT) + " 00:00:00+00";
        String toDate = monthAfter.atDay(1).format(DATE_FMT) + " 00:00:00+00";

        String fromDateOnly = nextMonth.atDay(1).format(DATE_FMT);
        String toDateOnly = monthAfter.atDay(1).format(DATE_FMT);

        if (!PARTITION_NAME_PATTERN.matcher(partitionName).matches()) {
            throw new IllegalStateException("잘못된 파티션 이름 형식: " + partitionName);
        }
        if (!DATE_PATTERN.matcher(fromDateOnly).matches() || !DATE_PATTERN.matcher(toDateOnly).matches()) {
            throw new IllegalStateException("잘못된 날짜 형식: " + fromDateOnly + " / " + toDateOnly);
        }

        String ddl = String.format(
                "CREATE TABLE IF NOT EXISTS %s PARTITION OF monitoring_results "
                + "FOR VALUES FROM ('%s') TO ('%s')",
                partitionName, fromDate, toDate);

        log.info("[partition-job] 파티션 생성 — {}", partitionName);
        entityManager.createNativeQuery(ddl).executeUpdate();
        log.info("[partition-job] 파티션 생성 완료 — {}", partitionName);
    }
}
