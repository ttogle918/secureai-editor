package io.secureai.backend.domain.analysis.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.secureai.backend.domain.analysis.dto.ChatRequest;
import io.secureai.backend.domain.analysis.entity.AnalysisSession;
import io.secureai.backend.domain.analysis.repository.AnalysisSessionRepository;
import io.secureai.backend.domain.project.entity.Project;
import io.secureai.backend.domain.project.repository.TeamMemberRepository;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ChatServiceTest {

    @Mock AnalysisSessionRepository sessionRepository;
    @Mock TeamMemberRepository teamMemberRepository;

    private ChatService chatService;

    private UUID userId;
    private UUID sessionId;
    private UUID projectId;
    private AnalysisSession session;

    @BeforeEach
    void setUp() {
        userId    = UUID.randomUUID();
        sessionId = UUID.randomUUID();
        projectId = UUID.randomUUID();

        Project project = Project.builder().name("test-project").build();
        ReflectionTestUtils.setField(project, "id", projectId);

        session = AnalysisSession.builder().project(project).build();
        ReflectionTestUtils.setField(session, "id", sessionId);

        // ChatService 는 RestClient 를 내부에서 생성하므로 직접 인스턴스화한다.
        // executor 는 가상 스레드를 사용하나 relay 로직은 별도 테스트에서 검증한다.
        chatService = new ChatService(
                "http://localhost:8000",   // agentUrl — 실제 호출 없음
                "test-internal-key",
                sessionRepository,
                teamMemberRepository,
                new ObjectMapper()
        );
    }

    // -----------------------------------------------------------------------
    // TC-1: 세션이 존재하고 권한이 있을 때 SseEmitter 반환
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("정상 요청 → SseEmitter 반환")
    void streamChat_returnsSseEmitterWhenAuthorized() {
        when(sessionRepository.findById(sessionId)).thenReturn(Optional.of(session));
        when(teamMemberRepository.existsByProjectIdAndUserId(projectId, userId)).thenReturn(true);

        ChatRequest request = new ChatRequest("취약점 설명해줘", List.of());

        SseEmitter emitter = chatService.streamChat(userId, sessionId, request);

        assertThat(emitter).isNotNull();
        // AI Engine 호출은 비동기 executor 에 위임되므로 여기서는 emitter 생성만 확인
    }

    // -----------------------------------------------------------------------
    // TC-2: 세션이 없을 때 SESSION_NOT_FOUND 예외
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("존재하지 않는 sessionId → SESSION_NOT_FOUND 예외")
    void streamChat_throwsWhenSessionNotFound() {
        when(sessionRepository.findById(sessionId)).thenReturn(Optional.empty());

        ChatRequest request = new ChatRequest("질문", List.of());

        assertThatThrownBy(() -> chatService.streamChat(userId, sessionId, request))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.SESSION_NOT_FOUND);

        verifyNoInteractions(teamMemberRepository);
    }

    // -----------------------------------------------------------------------
    // TC-3: 팀 멤버가 아닐 때 PROJECT_ACCESS_DENIED 예외
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("팀 멤버가 아닌 userId → PROJECT_ACCESS_DENIED 예외")
    void streamChat_throwsWhenNoProjectAccess() {
        when(sessionRepository.findById(sessionId)).thenReturn(Optional.of(session));
        when(teamMemberRepository.existsByProjectIdAndUserId(projectId, userId)).thenReturn(false);

        ChatRequest request = new ChatRequest("질문", List.of());

        assertThatThrownBy(() -> chatService.streamChat(userId, sessionId, request))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.PROJECT_ACCESS_DENIED);
    }
}
