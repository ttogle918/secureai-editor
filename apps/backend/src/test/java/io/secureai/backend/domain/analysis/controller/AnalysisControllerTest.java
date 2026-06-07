package io.secureai.backend.domain.analysis.controller;

import io.secureai.backend.domain.analysis.dto.AnalysisSessionResponse;
import io.secureai.backend.domain.analysis.dto.StartAnalysisRequest;
import io.secureai.backend.domain.analysis.service.AnalysisService;
import io.secureai.backend.domain.analysis.service.SseEmitterService;
import io.secureai.backend.global.response.ApiResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * AnalysisController 단위 테스트 — 세션 위임/상태코드와, SSE 구독 분기
 * (진행 중 → 구독 / 완료·에러 → 즉시 replay / 인증 실패 → error emitter)를 검증한다.
 */
@ExtendWith(MockitoExtension.class)
class AnalysisControllerTest {

    @Mock AnalysisService analysisService;
    @Mock SseEmitterService sseEmitterService;

    private AnalysisController controller;
    private final UUID userId = UUID.randomUUID();
    private final UUID sessionId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        controller = new AnalysisController(analysisService, sseEmitterService);
    }

    @Test
    @DisplayName("startAnalysis — 생성 결과를 201 로 반환한다")
    void startAnalysis_returns201() {
        StartAnalysisRequest req = mock(StartAnalysisRequest.class);
        AnalysisSessionResponse created = mock(AnalysisSessionResponse.class);
        when(analysisService.startAnalysis(userId, req)).thenReturn(created);

        var response = controller.startAnalysis(userId, req);

        assertThat(response.getStatusCode().value()).isEqualTo(201);
        assertThat(response.getBody().getData()).isSameAs(created);
    }

    @Test
    @DisplayName("listSessions — projectId + pageable 로 위임하고 200 을 반환한다")
    void listSessions_delegates() {
        UUID projectId = UUID.randomUUID();
        Pageable pageable = PageRequest.of(0, 20);
        @SuppressWarnings("unchecked")
        Page<AnalysisSessionResponse> page = mock(Page.class);
        when(analysisService.listSessions(userId, projectId, pageable)).thenReturn(page);

        var response = controller.listSessions(userId, projectId, pageable);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().getData()).isSameAs(page);
    }

    @Test
    @DisplayName("getSession / resumeSession — 위임하고 200 을 반환한다")
    void getAndResume_delegate() {
        AnalysisSessionResponse s = mock(AnalysisSessionResponse.class);
        when(analysisService.getSession(userId, sessionId)).thenReturn(s);
        when(analysisService.resumeSession(userId, sessionId)).thenReturn(s);

        assertThat(controller.getSession(userId, sessionId).getStatusCode().value()).isEqualTo(200);
        assertThat(controller.resumeSession(userId, sessionId).getStatusCode().value()).isEqualTo(200);
    }

    @Test
    @DisplayName("cancelSession — 취소를 위임하고 204 를 반환한다")
    void cancelSession_returns204() {
        ResponseEntity<Void> response = controller.cancelSession(userId, sessionId);

        assertThat(response.getStatusCode().value()).isEqualTo(204);
        verify(analysisService).cancelSession(userId, sessionId);
    }

    @Test
    @DisplayName("streamSession — 진행 중 세션은 SseEmitterService.subscribe 결과를 반환한다")
    void streamSession_inProgress_subscribes() {
        AnalysisSessionResponse session = mock(AnalysisSessionResponse.class);
        when(session.status()).thenReturn("running");
        when(analysisService.getSession(userId, sessionId)).thenReturn(session);
        SseEmitter subscribed = new SseEmitter();
        when(sseEmitterService.subscribe(sessionId)).thenReturn(subscribed);

        SseEmitter result = controller.streamSession(userId, sessionId);

        assertThat(result).isSameAs(subscribed);
    }

    @Test
    @DisplayName("streamSession — 이미 완료된 세션은 구독하지 않고 즉시 replay emitter 를 반환한다")
    void streamSession_completed_replaysWithoutSubscribe() {
        AnalysisSessionResponse session = mock(AnalysisSessionResponse.class);
        when(session.status()).thenReturn("completed");
        when(session.vulnCount()).thenReturn(3);
        when(analysisService.getSession(userId, sessionId)).thenReturn(session);

        SseEmitter result = controller.streamSession(userId, sessionId);

        assertThat(result).isNotNull();
        verify(sseEmitterService, never()).subscribe(any());
    }

    @Test
    @DisplayName("streamSession — 인증/세션 확인 실패 시 구독 없이 error emitter 를 반환한다")
    void streamSession_authFails_returnsErrorEmitter() {
        when(analysisService.getSession(userId, sessionId))
                .thenThrow(new RuntimeException("forbidden"));

        SseEmitter result = controller.streamSession(userId, sessionId);

        assertThat(result).isNotNull();
        verify(sseEmitterService, never()).subscribe(any());
    }
}
