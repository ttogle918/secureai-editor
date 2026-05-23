package io.secureai.backend.domain.cve.event;

/**
 * NVD CVE 동기화 완료 이벤트.
 *
 * <p>NvdSyncJob이 동기화 완료 후 발행하며,
 * MonitoringService가 구독해 CVE 재매칭을 트리거한다.
 *
 * @param upsertedCount 이번 동기화에서 upsert된 CVE 건수
 */
public record NvdSyncCompletedEvent(int upsertedCount) {
}
