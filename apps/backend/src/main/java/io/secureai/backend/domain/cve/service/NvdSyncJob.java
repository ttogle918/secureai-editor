package io.secureai.backend.domain.cve.service;

import io.secureai.backend.domain.cve.entity.CveData;
import io.secureai.backend.domain.cve.event.NvdSyncCompletedEvent;
import io.secureai.backend.domain.cve.repository.CveDataRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class NvdSyncJob {

    private static final int SYNC_DAYS_BACK = 7;

    private final NvdApiClient nvdApiClient;
    private final CveDataRepository cveDataRepository;
    private final ApplicationEventPublisher eventPublisher;

    @Scheduled(cron = "0 0 3 * * *")
    @SchedulerLock(name = "nvdSyncJob", lockAtMostFor = "PT2H", lockAtLeastFor = "PT30M")
    @Transactional
    public void syncRecentCves() {
        log.info("[nvd-sync] 최근 {}일 CVE 동기화 시작", SYNC_DAYS_BACK);
        List<CveData> fetched = nvdApiClient.fetchRecentCves(SYNC_DAYS_BACK);

        int upserted = 0;
        for (CveData incoming : fetched) {
            cveDataRepository.findByCveId(incoming.getCveId())
                    .ifPresentOrElse(
                            existing -> updateExisting(existing, incoming),
                            () -> cveDataRepository.save(incoming)
                    );
            upserted++;
        }

        log.info("[nvd-sync] 완료 — 처리={}", upserted);
        eventPublisher.publishEvent(new NvdSyncCompletedEvent(upserted));
    }

    private void updateExisting(CveData existing, CveData incoming) {
        existing.setDescription(incoming.getDescription());
        existing.setCvssScore(incoming.getCvssScore());
        existing.setCvssVector(incoming.getCvssVector());
        existing.setSeverity(incoming.getSeverity());
        existing.setModifiedAt(incoming.getModifiedAt());
        existing.setAffectedProducts(incoming.getAffectedProducts());
    }
}
