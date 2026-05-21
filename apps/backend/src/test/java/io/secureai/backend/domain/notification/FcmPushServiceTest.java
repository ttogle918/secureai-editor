package io.secureai.backend.domain.notification;

import com.google.firebase.messaging.BatchResponse;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingException;
import com.google.firebase.messaging.SendResponse;
import io.secureai.backend.domain.notification.service.FcmPushService;
import io.secureai.backend.domain.notification.service.FcmPushServiceNoOp;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatNoException;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class FcmPushServiceTest {

    private final UUID sessionId = UUID.randomUUID();
    private final UUID projectId = UUID.randomUUID();

    @Test
    @DisplayName("no-op 구현: Firebase 비활성화 시 예외 없이 무시한다")
    void noOp_doesNotThrow_whenFirebaseDisabled() {
        FcmPushServiceNoOp noOp = new FcmPushServiceNoOp();
        List<String> tokens = List.of("token-a", "token-b");

        // Firebase 비활성 환경에서도 예외 없이 동작해야 한다
        assertThatNoException().isThrownBy(
                () -> noOp.sendSessionCompleted(sessionId, projectId, tokens));
    }

    @Test
    @DisplayName("no-op 구현: 빈 토큰 목록에서도 예외 없이 무시한다")
    void noOp_doesNotThrow_withEmptyTokens() {
        FcmPushServiceNoOp noOp = new FcmPushServiceNoOp();

        assertThatNoException().isThrownBy(
                () -> noOp.sendSessionCompleted(sessionId, projectId, List.of()));
    }

    @Test
    @DisplayName("실제 FCM 구현: 토큰이 없으면 FirebaseMessaging을 호출하지 않는다")
    void fcmPushService_skipsMessaging_whenTokenListIsEmpty() throws Exception {
        FcmPushService service = new FcmPushService();

        try (MockedStatic<FirebaseMessaging> messagingStatic = mockStatic(FirebaseMessaging.class)) {
            service.sendSessionCompleted(sessionId, projectId, List.of());
            messagingStatic.verify(FirebaseMessaging::getInstance, never());
        }
    }

    @Test
    @DisplayName("실제 FCM 구현: 발송 실패 시 예외를 전파하지 않는다 (fire-and-forget)")
    void fcmPushService_doesNotPropagate_onMessagingException() throws Exception {
        FcmPushService service = new FcmPushService();

        try (MockedStatic<FirebaseMessaging> messagingStatic = mockStatic(FirebaseMessaging.class)) {
            FirebaseMessaging mockMessaging = mock(FirebaseMessaging.class);
            messagingStatic.when(FirebaseMessaging::getInstance).thenReturn(mockMessaging);
            when(mockMessaging.sendEachForMulticast(any()))
                    .thenThrow(mock(FirebaseMessagingException.class));

            List<String> tokens = List.of("token-x");
            // FCM 예외가 전파되지 않아야 한다 — 분석 결과에 영향 없음
            assertThatNoException().isThrownBy(
                    () -> service.sendSessionCompleted(sessionId, projectId, tokens));
        }
    }

    @Test
    @DisplayName("실제 FCM 구현: 다중 토큰 발송 시 성공/실패 결과를 로그로 기록한다")
    void fcmPushService_logsBatchResult_forMultipleTokens() throws Exception {
        FcmPushService service = new FcmPushService();

        try (MockedStatic<FirebaseMessaging> messagingStatic = mockStatic(FirebaseMessaging.class)) {
            FirebaseMessaging mockMessaging = mock(FirebaseMessaging.class);
            messagingStatic.when(FirebaseMessaging::getInstance).thenReturn(mockMessaging);

            BatchResponse mockBatch = mock(BatchResponse.class);
            SendResponse successResponse = mock(SendResponse.class);
            SendResponse failResponse = mock(SendResponse.class);
            when(successResponse.isSuccessful()).thenReturn(true);
            when(failResponse.isSuccessful()).thenReturn(false);
            when(failResponse.getException()).thenReturn(null);

            when(mockBatch.getSuccessCount()).thenReturn(1);
            when(mockBatch.getFailureCount()).thenReturn(1);
            when(mockBatch.getResponses()).thenReturn(List.of(successResponse, failResponse));
            when(mockMessaging.sendEachForMulticast(any())).thenReturn(mockBatch);

            List<String> tokens = List.of("token-ok", "token-fail");
            // 예외 없이 처리되어야 한다
            assertThatNoException().isThrownBy(
                    () -> service.sendSessionCompleted(sessionId, projectId, tokens));

            verify(mockMessaging).sendEachForMulticast(any());
        }
    }
}
