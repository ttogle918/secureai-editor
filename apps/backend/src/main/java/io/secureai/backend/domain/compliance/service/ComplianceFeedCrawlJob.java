package io.secureai.backend.domain.compliance.service;

import io.secureai.backend.domain.compliance.crawler.dto.FeedRefreshResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 컴플라이언스 피드 일일 크롤 스케줄 잡.
 *
 * <p>NvdSyncJob(03:00) 과 겹치지 않도록 매일 04:00 에 실행한다.
 * ShedLock 으로 분산 환경에서 중복 실행을 방지한다.
 *
 * <p>크롤 로직은 {@link ComplianceFeedCrawler} 에 위임한다 (SRP).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ComplianceFeedCrawlJob {

    private final ComplianceFeedCrawler crawler;

    /**
     * 매일 04:00 에 컴플라이언스 피드를 크롤링한다.
     *
     * <p>lockAtMostFor: 2시간 — 잡이 비정상 종료돼도 2시간 후 잠금 자동 해제.
     * lockAtLeastFor: 10분 — 잡이 빠르게 완료되더라도 중복 실행 최소 방지 간격.
     */
    @Scheduled(cron = "0 0 4 * * *")
    @SchedulerLock(name = "complianceFeedCrawlJob", lockAtMostFor = "PT2H", lockAtLeastFor = "PT10M")
    public void crawl() {
        log.info("[compliance-crawl-job] 일일 크롤 시작");
        FeedRefreshResult result = crawler.refresh();
        log.info("[compliance-crawl-job] 일일 크롤 완료 saved={} skipped={} failed={}",
                result.saved(), result.skipped(), result.failed());
    }
}
