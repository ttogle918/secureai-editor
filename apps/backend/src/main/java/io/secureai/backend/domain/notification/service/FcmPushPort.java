package io.secureai.backend.domain.notification.service;

import java.util.List;
import java.util.UUID;

/**
 * FCM Push 발송 포트 인터페이스.
 * Firebase 활성화 시 {@link FcmPushService}, 비활성화 시 {@link FcmPushServiceNoOp}가 구현체로 등록된다.
 */
public interface FcmPushPort {

    /**
     * 분석 세션 완료 알림 발송.
     *
     * @param sessionId 완료된 세션 ID
     * @param projectId 해당 프로젝트 ID
     * @param tokens    발송 대상 FCM 토큰 목록
     */
    void sendSessionCompleted(UUID sessionId, UUID projectId, List<String> tokens);
}
