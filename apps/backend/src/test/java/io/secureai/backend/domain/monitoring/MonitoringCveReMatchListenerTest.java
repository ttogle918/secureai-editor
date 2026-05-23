package io.secureai.backend.domain.monitoring;

import io.secureai.backend.domain.cve.event.NvdSyncCompletedEvent;
import io.secureai.backend.domain.monitoring.service.MonitoringCveReMatchListener;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;

@ExtendWith(MockitoExtension.class)
class MonitoringCveReMatchListenerTest {

    private final MonitoringCveReMatchListener listener = new MonitoringCveReMatchListener();

    @Test
    @DisplayName("onNvdSyncCompleted: NvdSyncCompletedEvent 수신 시 예외 없이 처리된다")
    void onNvdSyncCompleted_이벤트수신_예외없이처리() {
        // given
        NvdSyncCompletedEvent event = new NvdSyncCompletedEvent(42);

        // when & then
        assertDoesNotThrow(() -> listener.onNvdSyncCompleted(event));
    }
}
