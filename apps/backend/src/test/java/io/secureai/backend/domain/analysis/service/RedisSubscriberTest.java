package io.secureai.backend.domain.analysis.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.secureai.backend.domain.analysis.entity.AnalysisSession;
import io.secureai.backend.domain.analysis.event.SessionCompletedEvent;
import io.secureai.backend.domain.analysis.repository.AnalysisSessionRepository;
import io.secureai.backend.domain.project.entity.Project;
import io.secureai.backend.domain.user.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.redis.connection.Message;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RedisSubscriberTest {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    @Mock private SseEmitterService           sseEmitterService;
    @Mock private AnalysisSessionRepository   sessionRepository;
    @Mock private ApplicationEventPublisher   eventPublisher;

    private RedisSubscriber subscriber;

    @BeforeEach
    void setUp() {
        subscriber = new RedisSubscriber(sseEmitterService, sessionRepository, OBJECT_MAPPER, eventPublisher);
    }

    // ── 헬퍼 ─────────────────────────────────────────────────────────────────

    private Message buildMessage(UUID sessionId, String jsonBody) {
        String channel = "secureai:progress:" + sessionId;
        return new Message() {
            @Override public byte[] getBody()    { return jsonBody.getBytes(); }
            @Override public byte[] getChannel() { return channel.getBytes(); }
        };
    }

    // ── TC-1: snake_case 필드 패스스루 ───────────────────────────────────────

    @Test
    @DisplayName("progress 이벤트의 snake_case 필드가 Map payload에 그대로 포함된다")
    void onMessage_progress_snakeCaseFieldsPassedThrough() throws Exception {
        UUID sessionId = UUID.randomUUID();
        String body = OBJECT_MAPPER.writeValueAsString(Map.of(
                "session_id", sessionId.toString(),
                "type",       "progress",
                "node",       "sast",
                "phase",      "scanning",
                "file",       "src/main/UserService.java",
                "current",    3,
                "total",      10
        ));

        subscriber.onMessage(buildMessage(sessionId, body), null);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> captor = ArgumentCaptor.forClass(Map.class);
        verify(sseEmitterService).send(eq(sessionId), captor.capture());

        Map<String, Object> sent = captor.getValue();
        assertThat(sent).containsEntry("phase", "scanning");
        assertThat(sent).containsEntry("node",  "sast");
        assertThat(sent).containsKey("session_id");

        // completed/error가 아니므로 complete() 미호출
        verify(sseEmitterService, never()).complete(any());
    }

    // ── TC-2: stage_plan 이벤트 패스스루 ────────────────────────────────────

    @Test
    @DisplayName("stage_plan 이벤트의 stages 배열이 payload에 포함된다")
    void onMessage_stagePlan_stagesIncludedInPayload() throws Exception {
        UUID sessionId = UUID.randomUUID();
        String body = """
                {
                  "session_id": "%s",
                  "type": "stage_plan",
                  "stages": [
                    {"stage_no": 1, "name": "Auth", "file_count": 3},
                    {"stage_no": 2, "name": "Service", "file_count": 5}
                  ]
                }
                """.formatted(sessionId);

        subscriber.onMessage(buildMessage(sessionId, body), null);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> captor = ArgumentCaptor.forClass(Map.class);
        verify(sseEmitterService).send(eq(sessionId), captor.capture());

        Map<String, Object> sent = captor.getValue();
        assertThat(sent).containsKey("stages");
        assertThat(sent.get("stages")).isNotNull();
        verify(sseEmitterService, never()).complete(any());
    }

    // ── TC-3: stage_started / stage_completed 이벤트 ────────────────────────

    @Test
    @DisplayName("stage_started 이벤트에 stage_no, name, total_in_stage 필드가 전달된다")
    void onMessage_stageStarted_fieldsPresent() throws Exception {
        UUID sessionId = UUID.randomUUID();
        String body = OBJECT_MAPPER.writeValueAsString(Map.of(
                "session_id",     sessionId.toString(),
                "type",           "stage_started",
                "stage_no",       1,
                "name",           "Auth",
                "total_in_stage", 3
        ));

        subscriber.onMessage(buildMessage(sessionId, body), null);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> captor = ArgumentCaptor.forClass(Map.class);
        verify(sseEmitterService).send(eq(sessionId), captor.capture());

        Map<String, Object> sent = captor.getValue();
        assertThat(sent).containsEntry("stage_no", 1);
        assertThat(sent).containsEntry("total_in_stage", 3);
    }

    // ── TC-4: completed 이벤트 — 세션 상태 전이 + SSE complete ──────────────

    @Test
    @DisplayName("completed 이벤트 수신 시 세션을 완료 처리하고 SSE를 종료한다")
    void onMessage_completed_marksSessionAndClosesEmitter() throws Exception {
        UUID sessionId = UUID.randomUUID();
        UUID projectId = UUID.randomUUID();
        UUID userId    = UUID.randomUUID();

        Project mockProject = mock(Project.class);
        when(mockProject.getId()).thenReturn(projectId);

        User mockUser = mock(User.class);
        when(mockUser.getId()).thenReturn(userId);

        AnalysisSession mockSession = mock(AnalysisSession.class);
        when(mockSession.getProject()).thenReturn(mockProject);
        when(mockSession.getUser()).thenReturn(mockUser);
        when(sessionRepository.findById(sessionId)).thenReturn(Optional.of(mockSession));

        String body = OBJECT_MAPPER.writeValueAsString(Map.of(
                "session_id", sessionId.toString(),
                "type",       "completed",
                "vuln_count", 5
        ));

        subscriber.onMessage(buildMessage(sessionId, body), null);

        verify(mockSession).markCompleted();
        verify(sessionRepository).save(mockSession);
        verify(eventPublisher).publishEvent(any(SessionCompletedEvent.class));
        verify(sseEmitterService).complete(sessionId);
    }

    // ── TC-5: error 이벤트 — 세션 markError + SSE complete ─────────────────

    @Test
    @DisplayName("error 이벤트 수신 시 세션을 오류 처리하고 SSE를 종료한다")
    void onMessage_error_marksSessionErrorAndClosesEmitter() throws Exception {
        UUID sessionId = UUID.randomUUID();

        AnalysisSession mockSession = mock(AnalysisSession.class);
        when(sessionRepository.findById(sessionId)).thenReturn(Optional.of(mockSession));

        String body = OBJECT_MAPPER.writeValueAsString(Map.of(
                "session_id", sessionId.toString(),
                "type",       "error",
                "message",    "LLM timeout"
        ));

        subscriber.onMessage(buildMessage(sessionId, body), null);

        verify(mockSession).markError();
        verify(sessionRepository).save(mockSession);
        verify(eventPublisher, never()).publishEvent(any());
        verify(sseEmitterService).complete(sessionId);
    }

    // ── TC-6: cache_check 이벤트 — cache_hit 필드 포함 ──────────────────────

    @Test
    @DisplayName("cache_check 이벤트의 cache_hit 필드가 payload에 포함된다")
    void onMessage_cacheCheck_cacheHitFieldPresent() throws Exception {
        UUID sessionId = UUID.randomUUID();
        String body = OBJECT_MAPPER.writeValueAsString(Map.of(
                "session_id", sessionId.toString(),
                "type",       "progress",
                "node",       "cache_check",
                "phase",      "checking",
                "file",       "src/AuthService.java",
                "current",    1,
                "total",      5,
                "cache_hit",  true
        ));

        subscriber.onMessage(buildMessage(sessionId, body), null);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> captor = ArgumentCaptor.forClass(Map.class);
        verify(sseEmitterService).send(eq(sessionId), captor.capture());

        Map<String, Object> sent = captor.getValue();
        assertThat(sent).containsEntry("cache_hit", true);
        assertThat(sent).containsEntry("phase", "checking");
    }

    // ── TC-7: 손상된 JSON — 예외 전파 없이 skip ──────────────────────────────

    @Test
    @DisplayName("손상된 JSON 수신 시 예외 없이 처리되고 SSE는 호출되지 않는다")
    void onMessage_malformedJson_doesNotThrow() {
        UUID sessionId = UUID.randomUUID();
        String invalidBody = "NOT_VALID_JSON{{{";

        assertThatCode(() ->
            subscriber.onMessage(buildMessage(sessionId, invalidBody), null)
        ).doesNotThrowAnyException();

        verify(sseEmitterService, never()).send(any(), any());
        verify(sseEmitterService, never()).complete(any());
    }

    // ── TC-8: sessionId가 채널명에서 추출됨 (body 의존 없음) ─────────────────

    @Test
    @DisplayName("sessionId는 채널명에서 추출되며 body의 session_id 필드와 독립적이다")
    void onMessage_sessionIdExtractedFromChannel() throws Exception {
        UUID channelSessionId = UUID.randomUUID();
        UUID bodySessionId    = UUID.randomUUID(); // 의도적으로 다르게 설정

        String body = OBJECT_MAPPER.writeValueAsString(Map.of(
                "session_id", bodySessionId.toString(),
                "type",       "progress",
                "node",       "sast",
                "phase",      "scanning",
                "file",       "Foo.java",
                "current",    1,
                "total",      1
        ));

        subscriber.onMessage(buildMessage(channelSessionId, body), null);

        // 채널에서 추출한 ID로 send 호출됨
        verify(sseEmitterService).send(eq(channelSessionId), any());
        verify(sseEmitterService, never()).send(eq(bodySessionId), any());
    }
}
