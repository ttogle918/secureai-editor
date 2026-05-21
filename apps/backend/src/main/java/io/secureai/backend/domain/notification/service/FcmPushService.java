package io.secureai.backend.domain.notification.service;

import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Firebase Cloud Messaging 발송 서비스.
 * FirebaseApp 빈이 존재할 때만 활성화된다 ({@code firebase.enabled=true}).
 * 비활성화 시 {@link FcmPushServiceNoOp}가 사용된다.
 */
@Slf4j
@Service
@Primary
@ConditionalOnBean(FirebaseApp.class)
public class FcmPushService implements FcmPushPort {

    private static final String NOTIFICATION_TITLE = "분석 완료";
    private static final String NOTIFICATION_BODY = "보안 분석이 완료되었습니다. 결과를 확인하세요.";
    private static final String DEEPLINK_SCHEME = "secureai://session/";

    /**
     * 분석 세션 완료 Push 알림을 다중 토큰으로 발송한다.
     * 개별 토큰 발송 실패는 warn 로그로 기록하며, 전체 예외를 전파하지 않는다(fire-and-forget).
     *
     * @param sessionId 완료된 분석 세션 ID
     * @param projectId 해당 프로젝트 ID
     * @param tokens    수신 대상 FCM 토큰 목록 (보안: 로그 출력 금지)
     */
    @Override
    public void sendSessionCompleted(UUID sessionId, UUID projectId, List<String> tokens) {
        if (tokens.isEmpty()) {
            return;
        }
        MulticastMessage message = buildMessage(sessionId, projectId, tokens);
        try {
            BatchResponse response = FirebaseMessaging.getInstance().sendEachForMulticast(message);
            logBatchResult(response, tokens.size(), sessionId);
        } catch (FirebaseMessagingException e) {
            // FCM 발송 실패는 분석 결과에 영향 없음 — 예외 미전파
            log.warn("[fcm] sendEachForMulticast failed sessionId={} error={}", sessionId, e.getMessage());
        }
    }

    private MulticastMessage buildMessage(UUID sessionId, UUID projectId, List<String> tokens) {
        Map<String, String> data = Map.of(
                "sessionId", sessionId.toString(),
                "projectId", projectId.toString(),
                "deeplink", DEEPLINK_SCHEME + sessionId
        );
        Notification notification = Notification.builder()
                .setTitle(NOTIFICATION_TITLE)
                .setBody(NOTIFICATION_BODY)
                .build();
        return MulticastMessage.builder()
                .setNotification(notification)
                .putAllData(data)
                .addAllTokens(tokens)
                .build();
    }

    private void logBatchResult(BatchResponse response, int totalTokens, UUID sessionId) {
        int successCount = response.getSuccessCount();
        int failureCount = response.getFailureCount();
        log.info("[fcm] push sent sessionId={} success={} failure={}", sessionId, successCount, failureCount);
        if (failureCount > 0) {
            // 실패한 항목만 warn — 토큰 값은 로그에 출력하지 않는다
            response.getResponses().stream()
                    .filter(r -> !r.isSuccessful())
                    .forEach(r -> log.warn("[fcm] token delivery failed errorCode={}",
                            r.getException() != null ? r.getException().getMessagingErrorCode() : "unknown"));
        }
    }
}
