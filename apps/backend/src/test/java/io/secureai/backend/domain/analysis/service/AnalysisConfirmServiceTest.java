package io.secureai.backend.domain.analysis.service;

import io.secureai.backend.domain.analysis.dto.ConfirmPlanRequest;
import io.secureai.backend.domain.analysis.entity.AnalysisSession;
import io.secureai.backend.domain.analysis.entity.SessionStatus;
import io.secureai.backend.domain.analysis.repository.AnalysisSessionRepository;
import io.secureai.backend.domain.project.entity.Project;
import io.secureai.backend.domain.project.service.ProjectService;
import io.secureai.backend.domain.usage.service.TokenUsageService;
import io.secureai.backend.domain.user.entity.User;
import io.secureai.backend.domain.user.service.ProviderKeyService;
import io.secureai.backend.domain.user.service.UserService;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import io.secureai.backend.infrastructure.metrics.AnalysisMetrics;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * STAGE-2: AnalysisService.confirmPlan 단위 테스트.
 *
 * DoD 검증:
 * - 타 사용자 403(SESSION_NOT_FOUND)
 * - RUNNING 세션 재컨펌 = SESSION_ALREADY_CONFIRMED(409)
 * - COMPLETED 세션 재컨펌 = SESSION_ALREADY_CONFIRMED(409)
 * - AWAITING_CONFIRMATION 세션 = confirmPlan 호출 + RUNNING 전환
 */
@ExtendWith(MockitoExtension.class)
class AnalysisConfirmServiceTest {

    @Mock AnalysisSessionRepository sessionRepository;
    @Mock ProjectService projectService;
    @Mock AiAgentClient aiAgentClient;
    @Mock GitHubApiService gitHubApiService;
    @Mock UserService userService;
    @Mock ProviderKeyService providerKeyService;
    @Mock TokenUsageService tokenUsageService;
    @Mock AnalysisMetrics analysisMetrics;

    @InjectMocks AnalysisService analysisService;

    private UUID userId;
    private UUID sessionId;

    @BeforeEach
    void setUp() {
        userId    = UUID.randomUUID();
        sessionId = UUID.randomUUID();
    }

    // ── 타 사용자 403 ───────────────────────────────────────────────────────

    @Test
    @DisplayName("세션 소유자가 아니면 SESSION_NOT_FOUND 예외가 발생한다")
    void confirmPlan_otherUser_throwsSessionNotFound() {
        when(sessionRepository.findByIdAndUserId(sessionId, userId)).thenReturn(Optional.empty());

        ConfirmPlanRequest req = new ConfirmPlanRequest(null, List.of());

        assertThatThrownBy(() -> analysisService.confirmPlan(userId, sessionId, req))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.SESSION_NOT_FOUND);

        verify(aiAgentClient, never()).confirmPlan(any(), any(), any());
    }

    // ── RUNNING 재컨펌 409 ──────────────────────────────────────────────────

    /**
     * FAIL-2 수정: RUNNING 세션 재컨펌은 SESSION_ALREADY_CONFIRMED(409).
     * "이미 컨펌된" 의미이므로 SESSION_NOT_AWAITING_CONFIRMATION과 구분한다.
     */
    @Test
    @DisplayName("RUNNING 세션에 컨펌 요청하면 SESSION_ALREADY_CONFIRMED 예외")
    void confirmPlan_runningSession_throwsAlreadyConfirmed() {
        AnalysisSession session = buildSession(SessionStatus.RUNNING);
        when(sessionRepository.findByIdAndUserId(sessionId, userId)).thenReturn(Optional.of(session));

        ConfirmPlanRequest req = new ConfirmPlanRequest(null, List.of());

        assertThatThrownBy(() -> analysisService.confirmPlan(userId, sessionId, req))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.SESSION_ALREADY_CONFIRMED);

        verify(aiAgentClient, never()).confirmPlan(any(), any(), any());
    }

    // ── COMPLETED 재컨펌 409 ────────────────────────────────────────────────

    /**
     * FAIL-2 수정: COMPLETED 세션 재컨펌도 SESSION_ALREADY_CONFIRMED(409).
     */
    @Test
    @DisplayName("COMPLETED 세션에 컨펌 요청하면 SESSION_ALREADY_CONFIRMED 예외")
    void confirmPlan_completedSession_throwsAlreadyConfirmed() {
        AnalysisSession session = buildSession(SessionStatus.COMPLETED);
        when(sessionRepository.findByIdAndUserId(sessionId, userId)).thenReturn(Optional.of(session));

        ConfirmPlanRequest req = new ConfirmPlanRequest(null, List.of());

        assertThatThrownBy(() -> analysisService.confirmPlan(userId, sessionId, req))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.SESSION_ALREADY_CONFIRMED);

        verify(aiAgentClient, never()).confirmPlan(any(), any(), any());
    }

    // ── 정상 컨펌 ──────────────────────────────────────────────────────────

    @Test
    @DisplayName("AWAITING_CONFIRMATION 세션 컨펌 시 AI Engine 호출 후 RUNNING으로 전환된다")
    void confirmPlan_awaitingSession_transitionsToRunning() {
        AnalysisSession session = buildSession(SessionStatus.AWAITING_CONFIRMATION);
        when(sessionRepository.findByIdAndUserId(sessionId, userId)).thenReturn(Optional.of(session));
        when(sessionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        doNothing().when(aiAgentClient).confirmPlan(any(), any(), any());

        ConfirmPlanRequest req = new ConfirmPlanRequest(List.of(1, 2), List.of("excluded/file.java"));
        analysisService.confirmPlan(userId, sessionId, req);

        verify(aiAgentClient).confirmPlan(sessionId, List.of(1, 2), List.of("excluded/file.java"));
        assertThat(session.getStatus()).isEqualTo(SessionStatus.RUNNING);
    }

    @Test
    @DisplayName("selectedStageNos=null(전체 선택) 시 null이 그대로 전달된다")
    void confirmPlan_nullSelectedStages_passesNull() {
        AnalysisSession session = buildSession(SessionStatus.AWAITING_CONFIRMATION);
        when(sessionRepository.findByIdAndUserId(sessionId, userId)).thenReturn(Optional.of(session));
        when(sessionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        doNothing().when(aiAgentClient).confirmPlan(any(), any(), any());

        ConfirmPlanRequest req = new ConfirmPlanRequest(null, List.of());
        analysisService.confirmPlan(userId, sessionId, req);

        verify(aiAgentClient).confirmPlan(sessionId, null, List.of());
    }

    // ── 헬퍼 ────────────────────────────────────────────────────────────────

    private AnalysisSession buildSession(SessionStatus status) {
        // Project / User 는 lazy 프록시 역할만 하므로 mock 필요 없음 — null-safe 생성
        AnalysisSession session = AnalysisSession.builder()
                .project(mock(Project.class))
                .user(mock(User.class))
                .build();
        ReflectionTestUtils.setField(session, "id", sessionId);
        ReflectionTestUtils.setField(session, "status", status);
        return session;
    }
}
