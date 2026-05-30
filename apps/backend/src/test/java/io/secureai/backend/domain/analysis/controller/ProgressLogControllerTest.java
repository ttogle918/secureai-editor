package io.secureai.backend.domain.analysis.controller;

import io.secureai.backend.domain.analysis.dto.ProgressLogResponse;
import io.secureai.backend.domain.analysis.dto.ProgressSummaryResponse;
import io.secureai.backend.domain.analysis.dto.SaveProgressLogRequest;
import io.secureai.backend.domain.analysis.service.ProgressLogService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ProgressLogControllerTest {

    @Mock ProgressLogService progressLogService;

    private ProgressLogController controller;
    private final UUID userId = UUID.randomUUID();
    private final UUID sessionId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        controller = new ProgressLogController(progressLogService);
    }

    @Test
    @DisplayName("saveLog — 내부 로그 저장 결과를 201 로 반환한다")
    void saveLog_returns201() {
        SaveProgressLogRequest req = mock(SaveProgressLogRequest.class);
        ProgressLogResponse saved = mock(ProgressLogResponse.class);
        when(progressLogService.log(req)).thenReturn(saved);

        var response = controller.saveLog(req);

        assertThat(response.getStatusCode().value()).isEqualTo(201);
        assertThat(response.getBody().getData()).isSameAs(saved);
    }

    @Test
    @DisplayName("getProgressLogs — 세션 로그 목록을 위임하고 200 을 반환한다")
    void getProgressLogs_delegates() {
        List<ProgressLogResponse> logs = List.of(mock(ProgressLogResponse.class));
        when(progressLogService.getBySessionId(userId, sessionId)).thenReturn(logs);

        var response = controller.getProgressLogs(userId, sessionId);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().getData()).hasSize(1);
    }

    @Test
    @DisplayName("getProgressSummary — 진행률 요약을 위임하고 200 을 반환한다")
    void getProgressSummary_delegates() {
        ProgressSummaryResponse summary = mock(ProgressSummaryResponse.class);
        when(progressLogService.getSummary(userId, sessionId)).thenReturn(summary);

        var response = controller.getProgressSummary(userId, sessionId);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().getData()).isSameAs(summary);
    }
}
