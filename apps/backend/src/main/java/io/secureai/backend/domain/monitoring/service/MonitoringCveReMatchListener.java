package io.secureai.backend.domain.monitoring.service;

import io.secureai.backend.domain.cve.event.NvdSyncCompletedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class MonitoringCveReMatchListener {

    @EventListener
    public void onNvdSyncCompleted(NvdSyncCompletedEvent event) {
        log.info("[monitoring] NvdSync 완료 — CVE 재매칭 트리거 (upserted={})", event.upsertedCount());
        // TODO: SBOM 도메인 연계 후 구현 — NvdSyncCompletedEvent 수신 시 verified 프로젝트 CVE 재매칭
    }
}
