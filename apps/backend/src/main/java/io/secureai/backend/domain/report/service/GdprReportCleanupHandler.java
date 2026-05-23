package io.secureai.backend.domain.report.service;

import io.secureai.backend.domain.report.repository.ReportRepository;
import io.secureai.backend.global.event.GdprAccountDeletedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Component
@RequiredArgsConstructor
public class GdprReportCleanupHandler {

    private final ReportRepository reportRepository;

    @EventListener
    @Transactional
    public void onGdprAccountDeleted(GdprAccountDeletedEvent event) {
        int deleted = reportRepository.deleteByUserId(event.userId());
        log.info("GDPR 리포트 삭제. userId={} count={}", event.userId(), deleted);
    }
}
