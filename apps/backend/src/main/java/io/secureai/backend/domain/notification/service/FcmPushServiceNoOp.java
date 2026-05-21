package io.secureai.backend.domain.notification.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.stereotype.Service;

import com.google.firebase.FirebaseApp;

import java.util.List;
import java.util.UUID;

/**
 * Firebase 미설정 환경(개발/테스트)의 FCM Push no-op 폴백.
 * {@code firebase.enabled=false} 또는 {@link FirebaseApp} 빈 미존재 시 활성화된다.
 * 실제 발송 없이 debug 로그만 기록한다.
 */
@Slf4j
@Service
@ConditionalOnMissingBean(FirebaseApp.class)
public class FcmPushServiceNoOp implements FcmPushPort {

    @Override
    public void sendSessionCompleted(UUID sessionId, UUID projectId, List<String> tokens) {
        log.debug("[fcm-noop] Firebase disabled — skip push notification sessionId={} tokenCount={}",
                sessionId, tokens.size());
    }
}
