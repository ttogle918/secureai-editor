package io.secureai.backend.domain.analysis.service;

import io.secureai.backend.domain.analysis.dto.AnalysisSessionResponse;
import io.secureai.backend.domain.analysis.dto.StartAnalysisRequest;
import io.secureai.backend.domain.analysis.entity.AnalysisSession;
import io.secureai.backend.domain.analysis.entity.SessionStatus;
import io.secureai.backend.domain.analysis.repository.AnalysisSessionRepository;
import io.secureai.backend.domain.project.entity.Project;
import io.secureai.backend.domain.project.service.ProjectService;
import io.secureai.backend.domain.user.entity.User;
import io.secureai.backend.domain.user.service.UserService;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
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

@ExtendWith(MockitoExtension.class)
class AnalysisServiceTest {

    @Mock AnalysisSessionRepository sessionRepository;
    @Mock ProjectService projectService;
    @Mock AiAgentClient aiAgentClient;
    @Mock GitHubApiService gitHubApiService;
    @Mock UserService userService;
    @Mock io.secureai.backend.infrastructure.metrics.AnalysisMetrics analysisMetrics;

    @InjectMocks AnalysisService analysisService;

    private UUID userId;
    private UUID projectId;
    private UUID sessionId;
    private Project project;
    private User user;
    private UserService.UserAnalysisSettings settings;

    @BeforeEach
    void setUp() {
        userId    = UUID.randomUUID();
        projectId = UUID.randomUUID();
        sessionId = UUID.randomUUID();

        project = mock(Project.class);
        lenient().when(project.getId()).thenReturn(projectId);

        user = mock(User.class);
        lenient().when(user.getId()).thenReturn(userId);

        settings = new UserService.UserAnalysisSettings(null, null);
    }

    // ── startAnalysis ────────────────────────────────────────────────────────

    @Test
    @DisplayName("접근 권한이 없으면 PROJECT_ACCESS_DENIED 예외가 발생한다")
    void startAnalysis_notMember_throwsAccessDenied() {
        when(projectService.findOrThrow(projectId)).thenReturn(project);
        when(projectService.isMember(projectId, userId)).thenReturn(false);

        StartAnalysisRequest req = new StartAnalysisRequest(projectId, null, "local", null, null, false);

        assertThatThrownBy(() -> analysisService.startAnalysis(userId, req))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.PROJECT_ACCESS_DENIED);

        verifyNoInteractions(aiAgentClient);
    }

    @Test
    @DisplayName("RUNNING 세션이 있고 force=false이면 SESSION_ALREADY_RUNNING 예외가 발생한다")
    void startAnalysis_alreadyRunning_noForce_throwsSessionAlreadyRunning() {
        when(projectService.findOrThrow(projectId)).thenReturn(project);
        when(projectService.isMember(projectId, userId)).thenReturn(true);
        when(sessionRepository.existsByProjectIdAndStatus(projectId, SessionStatus.RUNNING)).thenReturn(true);

        StartAnalysisRequest req = new StartAnalysisRequest(projectId, null, "local", null, null, false);

        assertThatThrownBy(() -> analysisService.startAnalysis(userId, req))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.SESSION_ALREADY_RUNNING);
    }

    @Test
    @DisplayName("force=true이면 기존 RUNNING 세션을 INTERRUPTED로 전환하고 새 세션을 시작한다")
    void startAnalysis_force_interruptsExistingAndStartsNew() {
        AnalysisSession runningSession = AnalysisSession.builder().project(project).user(user).build();
        ReflectionTestUtils.setField(runningSession, "id", UUID.randomUUID());
        ReflectionTestUtils.setField(runningSession, "status", SessionStatus.RUNNING);

        when(projectService.findOrThrow(projectId)).thenReturn(project);
        when(projectService.isMember(projectId, userId)).thenReturn(true);
        when(sessionRepository.existsByProjectIdAndStatus(projectId, SessionStatus.RUNNING)).thenReturn(true);
        when(sessionRepository.findAllByStatus(SessionStatus.RUNNING)).thenReturn(List.of(runningSession));
        when(userService.findOrThrow(userId)).thenReturn(user);
        when(userService.getAnalysisSettings(userId)).thenReturn(settings);
        when(sessionRepository.save(any())).thenAnswer(inv -> {
            AnalysisSession s = inv.getArgument(0);
            if (ReflectionTestUtils.getField(s, "id") == null) {
                ReflectionTestUtils.setField(s, "id", sessionId);
            }
            return s;
        });

        StartAnalysisRequest req = new StartAnalysisRequest(projectId, "/workspace", "local", null, null, true);
        analysisService.startAnalysis(userId, req);

        verify(sessionRepository).markInterrupted(eq(runningSession.getId()),
                eq(SessionStatus.INTERRUPTED), eq(SessionStatus.RUNNING));
        verify(aiAgentClient).startAnalysis(any(), eq(projectId), eq("/workspace"),
                eq("local"), isNull(), isNull(), isNull(), isNull(), isNull(), isNull());
    }

    @Test
    @DisplayName("local sourceType으로 분석 시작 시 workspaceRoot가 없으면 기본 경로를 사용한다")
    void startAnalysis_localSourceType_usesDefaultWorkspaceRoot() {
        when(projectService.findOrThrow(projectId)).thenReturn(project);
        when(projectService.isMember(projectId, userId)).thenReturn(true);
        when(sessionRepository.existsByProjectIdAndStatus(any(), any())).thenReturn(false);
        when(userService.findOrThrow(userId)).thenReturn(user);
        when(userService.getAnalysisSettings(userId)).thenReturn(settings);
        when(sessionRepository.save(any())).thenAnswer(inv -> {
            AnalysisSession s = inv.getArgument(0);
            ReflectionTestUtils.setField(s, "id", sessionId);
            return s;
        });

        StartAnalysisRequest req = new StartAnalysisRequest(projectId, null, "local", null, null, false);
        AnalysisSessionResponse response = analysisService.startAnalysis(userId, req);

        verify(aiAgentClient).startAnalysis(any(), eq(projectId),
                eq("/workspace/" + projectId),
                eq("local"), isNull(), isNull(), isNull(), isNull(), isNull(), isNull());
        assertThat(response).isNotNull();
    }

    @Test
    @DisplayName("github sourceType으로 분석 시작 시 resolveAndValidate 후 에이전트를 호출한다")
    void startAnalysis_githubSourceType_resolvesAndCallsAgent() {
        GitHubApiService.GithubRepoInfo info =
                new GitHubApiService.GithubRepoInfo("owner", "repo", "main", "ghp_token");

        when(projectService.findOrThrow(projectId)).thenReturn(project);
        when(projectService.isMember(projectId, userId)).thenReturn(true);
        when(sessionRepository.existsByProjectIdAndStatus(any(), any())).thenReturn(false);
        when(userService.findOrThrow(userId)).thenReturn(user);
        when(userService.getAnalysisSettings(userId)).thenReturn(settings);
        when(gitHubApiService.resolveAndValidate(eq(userId), anyString(), isNull())).thenReturn(info);
        when(sessionRepository.save(any())).thenAnswer(inv -> {
            AnalysisSession s = inv.getArgument(0);
            ReflectionTestUtils.setField(s, "id", sessionId);
            return s;
        });

        StartAnalysisRequest req = new StartAnalysisRequest(
                projectId, null, "github", "https://github.com/owner/repo", null, false);
        analysisService.startAnalysis(userId, req);

        verify(gitHubApiService).resolveAndValidate(userId, "https://github.com/owner/repo", null);
        verify(aiAgentClient).startAnalysis(any(), eq(projectId), isNull(),
                eq("github"), eq("owner"), eq("repo"), eq("main"), eq("ghp_token"), isNull(), isNull());
    }

    // ── resumeSession ────────────────────────────────────────────────────────

    @Test
    @DisplayName("resumeSession — 세션이 없으면 SESSION_NOT_FOUND 예외가 발생한다")
    void resumeSession_notFound_throwsSessionNotFound() {
        when(sessionRepository.findByIdAndUserId(sessionId, userId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> analysisService.resumeSession(userId, sessionId))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.SESSION_NOT_FOUND);
    }

    @Test
    @DisplayName("resumeSession — 세션 상태가 INTERRUPTED가 아니면 SESSION_NOT_RESUMABLE 예외가 발생한다")
    void resumeSession_statusNotInterrupted_throwsNotResumable() {
        AnalysisSession session = AnalysisSession.builder().project(project).user(user).build();
        ReflectionTestUtils.setField(session, "status", SessionStatus.RUNNING);
        when(sessionRepository.findByIdAndUserId(sessionId, userId)).thenReturn(Optional.of(session));

        assertThatThrownBy(() -> analysisService.resumeSession(userId, sessionId))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.SESSION_NOT_RESUMABLE);
    }

    @Test
    @DisplayName("resumeSession — 성공 시 RUNNING으로 변경하고 에이전트를 호출한다")
    void resumeSession_success_callsAgentAndSaves() {
        AnalysisSession session = AnalysisSession.builder().project(project).user(user).build();
        ReflectionTestUtils.setField(session, "id", sessionId);
        ReflectionTestUtils.setField(session, "status", SessionStatus.INTERRUPTED);
        when(sessionRepository.findByIdAndUserId(sessionId, userId)).thenReturn(Optional.of(session));

        analysisService.resumeSession(userId, sessionId);

        assertThat(session.getStatus()).isEqualTo(SessionStatus.RUNNING);
        verify(sessionRepository).save(session);
        verify(aiAgentClient).resumeAnalysis(sessionId);
    }

    // ── cancelSession ────────────────────────────────────────────────────────

    @Test
    @DisplayName("cancelSession — 성공 시 CANCELLED로 변경하고 에이전트에 취소를 알린다")
    void cancelSession_success_callsAgentAndSaves() {
        AnalysisSession session = AnalysisSession.builder().project(project).user(user).build();
        ReflectionTestUtils.setField(session, "id", sessionId);
        ReflectionTestUtils.setField(session, "status", SessionStatus.RUNNING);
        when(sessionRepository.findByIdAndUserId(sessionId, userId)).thenReturn(Optional.of(session));

        analysisService.cancelSession(userId, sessionId);

        assertThat(session.getStatus()).isEqualTo(SessionStatus.CANCELLED);
        verify(sessionRepository).save(session);
        verify(aiAgentClient).cancelAnalysis(sessionId);
    }
}
