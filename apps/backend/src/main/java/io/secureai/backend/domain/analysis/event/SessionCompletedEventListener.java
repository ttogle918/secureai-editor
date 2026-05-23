package io.secureai.backend.domain.analysis.event;

import io.secureai.backend.domain.notification.service.DeviceTokenService;
import io.secureai.backend.domain.notification.service.FcmPushPort;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 분석 세션 완료 이벤트 구독자.
 * FCM Push 알림 발송을 비동기로 처리한다.
 * 발송 실패 시 분석 결과에 영향이 없도록 예외를 내부에서 처리한다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SessionCompletedEventListener {

    private final DeviceTokenService deviceTokenService;
    private final FcmPushPort fcmPushPort;

    @EventListener
    @Async("analysisExecutor")
    public void onSessionCompleted(SessionCompletedEvent event) {
        List<String> tokens = deviceTokenService.findTokensByUserId(event.getUserId());
        if (tokens.isEmpty()) {
            log.debug("[fcm-listener] no device tokens registered userId={}", event.getUserId());
            return;
        }
        fcmPushPort.sendSessionCompleted(event.getSessionId(), event.getProjectId(), tokens);
    }
}
