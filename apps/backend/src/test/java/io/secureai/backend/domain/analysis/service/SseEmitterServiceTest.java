package io.secureai.backend.domain.analysis.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import static org.assertj.core.api.Assertions.*;

class SseEmitterServiceTest {

    private SseEmitterService service;

    @BeforeEach
    void setUp() {
        service = new SseEmitterService();
    }

    @SuppressWarnings("unchecked")
    private Map<UUID, SseEmitter> getEmittersMap() {
        return (ConcurrentHashMap<UUID, SseEmitter>)
                ReflectionTestUtils.getField(service, "emitters");
    }

    // -----------------------------------------------------------------------
    // TC-1: subscribe() — emitter가 맵에 등록되고 반환됨
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("subscribe 호출 시 non-null SseEmitter가 반환되고 레지스트리에 등록됨")
    void subscribe_registersEmitterAndReturnsIt() {
        UUID sessionId = UUID.randomUUID();

        SseEmitter emitter = service.subscribe(sessionId);

        assertThat(emitter).isNotNull();
        assertThat(getEmittersMap()).containsKey(sessionId);
    }

    // -----------------------------------------------------------------------
    // TC-2: 중복 subscribe — 기존 emitter 교체
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("같은 sessionId로 subscribe 재호출 시 새 emitter로 교체됨")
    void subscribe_replacesExistingEmitter() {
        UUID sessionId = UUID.randomUUID();

        SseEmitter first  = service.subscribe(sessionId);
        SseEmitter second = service.subscribe(sessionId);

        assertThat(second).isNotSameAs(first);
        assertThat(getEmittersMap().get(sessionId)).isSameAs(second);
    }

    // -----------------------------------------------------------------------
    // TC-3: send() — 등록되지 않은 세션은 no-op
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("미등록 sessionId로 send 호출 시 예외 없이 종료됨")
    void send_isNoOpForUnregisteredSession() {
        UUID unknownId = UUID.randomUUID();

        assertThatCode(() -> service.send(unknownId, "payload"))
                .doesNotThrowAnyException();

        assertThat(getEmittersMap()).doesNotContainKey(unknownId);
    }

    // -----------------------------------------------------------------------
    // TC-4: complete() — 등록된 emitter 제거 + 미등록 세션 no-op
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("complete 호출 시 레지스트리에서 emitter가 제거됨")
    void complete_removesEmitterFromRegistry() {
        UUID sessionId = UUID.randomUUID();
        service.subscribe(sessionId);
        assertThat(getEmittersMap()).containsKey(sessionId);

        service.complete(sessionId);

        assertThat(getEmittersMap()).doesNotContainKey(sessionId);
    }

    @Test
    @DisplayName("미등록 sessionId로 complete 호출 시 예외 없이 종료됨")
    void complete_isNoOpForUnregisteredSession() {
        assertThatCode(() -> service.complete(UUID.randomUUID()))
                .doesNotThrowAnyException();
    }

    // -----------------------------------------------------------------------
    // TC-5: completeWithError() — 등록된 emitter 제거
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("completeWithError 호출 시 레지스트리에서 emitter가 제거됨")
    void completeWithError_removesEmitterFromRegistry() {
        UUID sessionId = UUID.randomUUID();
        service.subscribe(sessionId);

        service.completeWithError(sessionId, new RuntimeException("test error"));

        assertThat(getEmittersMap()).doesNotContainKey(sessionId);
    }
}
