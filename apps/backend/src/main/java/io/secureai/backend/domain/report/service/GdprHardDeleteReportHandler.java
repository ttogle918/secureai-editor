package io.secureai.backend.domain.report.service;

import io.secureai.backend.domain.report.repository.ReportRepository;
import io.secureai.backend.global.event.GdprUserHardDeleteEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * GDPR 하드 삭제 이벤트 수신 — report 도메인 연관 데이터 삭제.
 *
 * <p>GdprHardDeleteService 가 발행한 GdprUserHardDeleteEvent 를 수신하여
 * 해당 사용자의 리포트 데이터를 삭제한다.
 * 도메인 간 직접 Repository 주입 금지 원칙에 따라 이벤트 방식을 사용한다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class GdprHardDeleteReportHandler {

    private final ReportRepository reportRepository;

    @EventListener
    @Transactional
    public void onGdprUserHardDelete(GdprUserHardDeleteEvent event) {
        int deleted = reportRepository.deleteByUserId(event.userId());
        log.info("[gdpr-hard-delete] 리포트 삭제 완료. userId={} count={}", event.userId(), deleted);
    }
}
