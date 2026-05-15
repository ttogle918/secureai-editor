package io.secureai.backend.domain.dast.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.secureai.backend.domain.dast.dto.DastExecuteRequest;
import io.secureai.backend.domain.dast.dto.DastExecuteResponse;
import io.secureai.backend.domain.dast.entity.ExploitResult;
import io.secureai.backend.domain.dast.entity.ScanStatus;
import io.secureai.backend.domain.dast.repository.ExploitResultRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DastExecutionServiceTest {

    @Mock
    private DockerSandboxManager dockerSandboxManager;

    @Mock
    private ExploitResultPersister exploitResultPersister;

    @Mock
    private ExploitResultRepository exploitResultRepository;

    private DastExecutionService service;

    private static final String CONTAINER_ID = "abc123container";
    private static final String VULN_ID = UUID.randomUUID().toString();
    private static final String VULN_TYPE = "SQL_INJECTION";

    @BeforeEach
    void setUp() {
        service = new DastExecutionService(dockerSandboxManager, exploitResultPersister, exploitResultRepository, new ObjectMapper());

        // saveInitial() 이 RUNNING 상태의 ExploitResult를 반환하도록 스텁
        ExploitResult initial = ExploitResult.builder()
                .sessionId(UUID.randomUUID())
                .vulnId(UUID.fromString(VULN_ID))
                .vulnType(VULN_TYPE)
                .targetUrl("https://target.example.com")
                .status(ScanStatus.RUNNING)
                .build();
        when(exploitResultPersister.saveInitial(any(UUID.class), any())).thenReturn(initial);
    }

    @Test
    @DisplayName("execute - 컨테이너 실행 성공 및 JSON 파싱 성공 시 success=true 반환")
    void execute_whenContainerSucceeds_returnsSuccessResponse() {
        // given
        DastExecuteRequest req = buildRequest(Map.of("id", "1"));
        when(dockerSandboxManager.createAndStart(any(), any(), any())).thenReturn(CONTAINER_ID);
        when(dockerSandboxManager.waitForExit(eq(CONTAINER_ID), anyLong())).thenReturn(0);
        when(dockerSandboxManager.collectLogs(CONTAINER_ID))
                .thenReturn("some output\n{\"success\":true,\"payload\":\"1 OR 1=1\",\"evidence\":\"Login bypassed\",\"response_snippet\":\"200 OK\"}\n");

        // when
        DastExecuteResponse response = service.execute(req);

        // then
        assertThat(response.success()).isTrue();
        assertThat(response.payload()).isEqualTo("1 OR 1=1");
        assertThat(response.evidence()).isEqualTo("Login bypassed");
        assertThat(response.containerId()).isEqualTo(CONTAINER_ID);
        verify(dockerSandboxManager).forceRemove(CONTAINER_ID);
    }

    @Test
    @DisplayName("execute - 컨테이너 로그에 JSON 없으면 success=false, evidence='log parse failed'")
    void execute_whenLogHasNoJson_returnsLogParseFailedResponse() {
        // given
        DastExecuteRequest req = buildRequest(null);
        when(dockerSandboxManager.createAndStart(any(), any(), any())).thenReturn(CONTAINER_ID);
        when(dockerSandboxManager.waitForExit(eq(CONTAINER_ID), anyLong())).thenReturn(0);
        when(dockerSandboxManager.collectLogs(CONTAINER_ID)).thenReturn("traceback error\nNone");

        // when
        DastExecuteResponse response = service.execute(req);

        // then
        assertThat(response.success()).isFalse();
        assertThat(response.evidence()).isEqualTo("log parse failed");
        verify(dockerSandboxManager).forceRemove(CONTAINER_ID);
    }

    @Test
    @DisplayName("execute - DockerSandboxException(TIMEOUT) 발생 시 TIMEOUT 상태로 저장 후 failure 반환")
    void execute_whenDockerTimeout_savesTimeoutStatusAndReturnsFailure() {
        // given
        DastExecuteRequest req = buildRequest(null);
        when(dockerSandboxManager.createAndStart(any(), any(), any())).thenReturn(CONTAINER_ID);
        when(dockerSandboxManager.waitForExit(eq(CONTAINER_ID), anyLong()))
                .thenThrow(new DockerSandboxException("timeout", ScanStatus.TIMEOUT));

        // when
        DastExecuteResponse response = service.execute(req);

        // then
        assertThat(response.success()).isFalse();

        ArgumentCaptor<ScanStatus> statusCaptor = ArgumentCaptor.forClass(ScanStatus.class);
        verify(exploitResultPersister).saveFailed(any(), statusCaptor.capture(), anyString(), anyLong());
        assertThat(statusCaptor.getValue()).isEqualTo(ScanStatus.TIMEOUT);

        verify(dockerSandboxManager).forceRemove(CONTAINER_ID);
    }

    @Test
    @DisplayName("execute - 예외 발생 시에도 finally 블록에서 forceRemove 반드시 호출")
    void execute_onAnyException_alwaysCallsForceRemove() {
        // given
        DastExecuteRequest req = buildRequest(null);
        when(dockerSandboxManager.createAndStart(any(), any(), any())).thenReturn(CONTAINER_ID);
        when(dockerSandboxManager.waitForExit(eq(CONTAINER_ID), anyLong()))
                .thenThrow(new RuntimeException("unexpected error"));

        // when
        service.execute(req);

        // then
        verify(dockerSandboxManager).forceRemove(CONTAINER_ID);
    }

    @Test
    @DisplayName("execute - 컨테이너 생성 시 RUNNING 상태로 ExploitResult 초기 저장 요청")
    void execute_onStart_callsSaveInitial() {
        // given
        DastExecuteRequest req = buildRequest(null);
        when(dockerSandboxManager.createAndStart(any(), any(), any())).thenReturn(CONTAINER_ID);
        when(dockerSandboxManager.waitForExit(eq(CONTAINER_ID), anyLong())).thenReturn(0);
        when(dockerSandboxManager.collectLogs(CONTAINER_ID)).thenReturn("{\"success\":false}");

        // when
        service.execute(req);

        // then
        verify(exploitResultPersister).saveInitial(any(UUID.class), eq(req));
    }

    @Test
    @DisplayName("execute - params 가 null 이어도 예외 없이 실행")
    void execute_withNullParams_doesNotThrow() {
        // given
        DastExecuteRequest req = buildRequest(null);
        when(dockerSandboxManager.createAndStart(any(), any(), any())).thenReturn(CONTAINER_ID);
        when(dockerSandboxManager.waitForExit(eq(CONTAINER_ID), anyLong())).thenReturn(0);
        when(dockerSandboxManager.collectLogs(CONTAINER_ID)).thenReturn("{\"success\":false}");

        // when / then
        assertThatCode(() -> service.execute(req)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("execute - 로그의 마지막 JSON 라인을 파싱해야 함 (중간 JSON 무시)")
    void execute_parsesLastJsonLine() {
        // given
        DastExecuteRequest req = buildRequest(null);
        when(dockerSandboxManager.createAndStart(any(), any(), any())).thenReturn(CONTAINER_ID);
        when(dockerSandboxManager.waitForExit(eq(CONTAINER_ID), anyLong())).thenReturn(0);
        // 중간에 JSON 이 있고, 마지막 JSON 이 최종 결과
        when(dockerSandboxManager.collectLogs(CONTAINER_ID)).thenReturn(
                "{\"success\":false,\"evidence\":\"intermediate\"}\n"
                + "some log line\n"
                + "{\"success\":true,\"evidence\":\"final result\",\"payload\":\"payload123\"}\n"
        );

        // when
        DastExecuteResponse response = service.execute(req);

        // then
        assertThat(response.success()).isTrue();
        assertThat(response.evidence()).isEqualTo("final result");
    }

    @Test
    @DisplayName("execute - 실행 성공 시 saveSuccess 호출 확인")
    void execute_onSuccess_callsSaveSuccess() {
        // given
        DastExecuteRequest req = buildRequest(null);
        when(dockerSandboxManager.createAndStart(any(), any(), any())).thenReturn(CONTAINER_ID);
        when(dockerSandboxManager.waitForExit(eq(CONTAINER_ID), anyLong())).thenReturn(0);
        when(dockerSandboxManager.collectLogs(CONTAINER_ID))
                .thenReturn("{\"success\":true,\"evidence\":\"confirmed\",\"payload\":\"p\"}");

        // when
        service.execute(req);

        // then
        verify(exploitResultPersister).saveSuccess(any(), any(DastExecuteResponse.class), anyLong());
        verify(exploitResultPersister, never()).saveFailed(any(), any(), any(), anyLong());
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private DastExecuteRequest buildRequest(Map<String, String> params) {
        return new DastExecuteRequest(
                VULN_ID,
                VULN_TYPE,
                "https://target.example.com/login",
                "/api/login",
                params
        );
    }
}
