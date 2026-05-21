package io.secureai.backend.domain.dast.service;

import com.fasterxml.jackson.databind.ObjectMapper;
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
import org.springframework.data.redis.core.RedisTemplate;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DastResultHandlerTest {

    @Mock
    private ExploitResultRepository exploitResultRepository;

    @Mock
    private RedisTemplate<String, String> redisTemplate;

    private DastResultHandler handler;

    private UUID sessionId;
    private UUID vulnId;

    @BeforeEach
    void setUp() {
        handler = new DastResultHandler(exploitResultRepository, redisTemplate, new ObjectMapper());
        sessionId = UUID.randomUUID();
        vulnId = UUID.randomUUID();

        when(exploitResultRepository.save(any(ExploitResult.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    @DisplayName("handle - 기존 ExploitResult 조회 성공 시 결과 업데이트 후 저장")
    void handle_whenExistingResult_updatesAndSaves() {
        // given
        ExploitResult existing = buildExploitResult(ScanStatus.RUNNING);
        when(exploitResultRepository.findByVulnId(vulnId)).thenReturn(Optional.of(existing));
        DastExecuteResponse response = buildResponse(true, "SQLi confirmed", "1 OR 1=1");

        // when
        handler.handle(sessionId, vulnId, response);

        // then
        ArgumentCaptor<ExploitResult> captor = ArgumentCaptor.forClass(ExploitResult.class);
        verify(exploitResultRepository).save(captor.capture());
        ExploitResult saved = captor.getValue();
        assertThat(saved.isSuccess()).isTrue();
        assertThat(saved.getEvidence()).isEqualTo("SQLi confirmed");
        assertThat(saved.getStatus()).isEqualTo(ScanStatus.SUCCESS);
        assertThat(saved.getSessionId()).isEqualTo(sessionId);
    }

    @Test
    @DisplayName("handle - ExploitResult 없으면 신규 생성 후 저장")
    void handle_whenNoExistingResult_createsNew() {
        // given
        when(exploitResultRepository.findByVulnId(vulnId)).thenReturn(Optional.empty());
        DastExecuteResponse response = buildResponse(false, "no evidence", null);

        // when
        handler.handle(sessionId, vulnId, response);

        // then
        ArgumentCaptor<ExploitResult> captor = ArgumentCaptor.forClass(ExploitResult.class);
        verify(exploitResultRepository).save(captor.capture());
        ExploitResult saved = captor.getValue();
        assertThat(saved.getSessionId()).isEqualTo(sessionId);
        assertThat(saved.getVulnId()).isEqualTo(vulnId);
        assertThat(saved.getStatus()).isEqualTo(ScanStatus.FAILED);
    }

    @Test
    @DisplayName("handle - success=true 이면 ScanStatus.SUCCESS 저장")
    void handle_whenResponseSuccess_savesSuccessStatus() {
        // given
        ExploitResult existing = buildExploitResult(ScanStatus.RUNNING);
        when(exploitResultRepository.findByVulnId(vulnId)).thenReturn(Optional.of(existing));
        DastExecuteResponse response = buildResponse(true, "exploit confirmed", "payload");

        // when
        handler.handle(sessionId, vulnId, response);

        // then
        ArgumentCaptor<ExploitResult> captor = ArgumentCaptor.forClass(ExploitResult.class);
        verify(exploitResultRepository).save(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo(ScanStatus.SUCCESS);
    }

    @Test
    @DisplayName("handle - success=false 이면 ScanStatus.FAILED 저장")
    void handle_whenResponseFailure_savesFailedStatus() {
        // given
        ExploitResult existing = buildExploitResult(ScanStatus.RUNNING);
        when(exploitResultRepository.findByVulnId(vulnId)).thenReturn(Optional.of(existing));
        DastExecuteResponse response = buildResponse(false, "no vulnerability found", null);

        // when
        handler.handle(sessionId, vulnId, response);

        // then
        ArgumentCaptor<ExploitResult> captor = ArgumentCaptor.forClass(ExploitResult.class);
        verify(exploitResultRepository).save(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo(ScanStatus.FAILED);
    }

    @Test
    @DisplayName("handle - Redis PUBLISH 호출 시 채널 이름에 sessionId 포함")
    void handle_publishesToCorrectRedisChannel() {
        // given
        when(exploitResultRepository.findByVulnId(vulnId)).thenReturn(Optional.empty());
        DastExecuteResponse response = buildResponse(true, "evidence", "payload");

        // when
        handler.handle(sessionId, vulnId, response);

        // then
        ArgumentCaptor<String> channelCaptor = ArgumentCaptor.forClass(String.class);
        verify(redisTemplate).convertAndSend(channelCaptor.capture(), anyString());
        assertThat(channelCaptor.getValue()).isEqualTo("secureai:dast:logs:" + sessionId);
    }

    @Test
    @DisplayName("handle - Redis PUBLISH 메시지에 type, vulnId, success 포함")
    void handle_publishMessageContainsRequiredFields() throws Exception {
        // given
        when(exploitResultRepository.findByVulnId(vulnId)).thenReturn(Optional.empty());
        DastExecuteResponse response = buildResponse(true, "evidence text", "payload");
        ObjectMapper objectMapper = new ObjectMapper();

        // when
        handler.handle(sessionId, vulnId, response);

        // then
        ArgumentCaptor<String> messageCaptor = ArgumentCaptor.forClass(String.class);
        verify(redisTemplate).convertAndSend(anyString(), messageCaptor.capture());

        String json = messageCaptor.getValue();
        var parsed = objectMapper.readTree(json);
        assertThat(parsed.get("type").asText()).isEqualTo("dast_result");
        assertThat(parsed.get("vulnId").asText()).isEqualTo(vulnId.toString());
        assertThat(parsed.get("success").asBoolean()).isTrue();
        assertThat(parsed.get("evidence").asText()).isEqualTo("evidence text");
    }

    @Test
    @DisplayName("handle - evidence 가 null 이면 빈 문자열로 Redis 발행")
    void handle_whenEvidenceNull_publishesEmptyString() throws Exception {
        // given
        when(exploitResultRepository.findByVulnId(vulnId)).thenReturn(Optional.empty());
        DastExecuteResponse response = buildResponse(false, null, null);
        ObjectMapper objectMapper = new ObjectMapper();

        // when
        handler.handle(sessionId, vulnId, response);

        // then
        ArgumentCaptor<String> messageCaptor = ArgumentCaptor.forClass(String.class);
        verify(redisTemplate).convertAndSend(anyString(), messageCaptor.capture());
        var parsed = objectMapper.readTree(messageCaptor.getValue());
        assertThat(parsed.get("evidence").asText()).isEqualTo("");
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private ExploitResult buildExploitResult(ScanStatus status) {
        return ExploitResult.builder()
                .sessionId(sessionId)
                .vulnId(vulnId)
                .vulnType("SQL_INJECTION")
                .targetUrl("https://target.example.com")
                .status(status)
                .build();
    }

    private DastExecuteResponse buildResponse(boolean success, String evidence, String payload) {
        return new DastExecuteResponse(success, payload, evidence, null, null, "containerXyz");
    }
}
