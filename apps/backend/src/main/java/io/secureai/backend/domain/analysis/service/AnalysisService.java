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
import io.secureai.backend.infrastructure.metrics.AnalysisMetrics;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AnalysisService {

    private final AnalysisSessionRepository sessionRepository;
    private final ProjectService projectService;
    private final AiAgentClient aiAgentClient;
    private final GitHubApiService gitHubApiService;
    private final UserService userService;
    private final AnalysisMetrics analysisMetrics;

    @Transactional
    public AnalysisSessionResponse startAnalysis(UUID userId, StartAnalysisRequest request) {
        Project project = projectService.findOrThrow(request.projectId());
        if (!projectService.isMember(request.projectId(), userId)) {
            throw new BusinessException(ErrorCode.PROJECT_ACCESS_DENIED);
        }

        handleRunningSession(request.projectId(), request.isForce());

        User user = userService.findOrThrow(userId);
        AnalysisSession session = AnalysisSession.builder()
                .project(project)
                .user(user)
                .scanMode(request.effectiveScanMode())
                .build();
        sessionRepository.save(session);
        session.markRunning();
        sessionRepository.save(session);

        analysisMetrics.incrementSessions();

        UserService.UserAnalysisSettings settings = userService.getAnalysisSettings(userId);
        try {
            dispatchToAgent(session, project, userId, request, settings);
        } catch (Exception e) {
            analysisMetrics.incrementErrors();
            throw e;
        }

        log.info("[analysis] started sessionId={} projectId={} sourceType={} scanMode={}",
                session.getId(), project.getId(), request.effectiveSourceType(), request.effectiveScanMode());
        return AnalysisSessionResponse.from(session);
    }

    private void handleRunningSession(UUID projectId, boolean force) {
        if (!sessionRepository.existsByProjectIdAndStatus(projectId, SessionStatus.RUNNING)) return;
        if (!force) throw new BusinessException(ErrorCode.SESSION_ALREADY_RUNNING);
        sessionRepository.findAllByStatus(SessionStatus.RUNNING).stream()
                .filter(s -> s.getProject().getId().equals(projectId))
                .forEach(s -> sessionRepository.markInterrupted(
                        s.getId(), SessionStatus.INTERRUPTED, SessionStatus.RUNNING));
    }

    private void dispatchToAgent(AnalysisSession session, Project project, UUID userId,
                                 StartAnalysisRequest request, UserService.UserAnalysisSettings settings) {
        if ("github".equalsIgnoreCase(request.effectiveSourceType())) {
            GitHubApiService.GithubRepoInfo info =
                    gitHubApiService.resolveAndValidate(userId, request.githubRepoUrl(), request.githubRef());
            aiAgentClient.startAnalysis(
                    session.getId(), project.getId(), null,
                    "github", info.owner(), info.repo(), info.ref(), info.token(),
                    settings.preferredModel(), settings.apiKey(), request.effectiveScanMode(),
                    request.fileFilter());
        } else {
            String workspaceRoot = request.workspaceRoot() != null
                    ? request.workspaceRoot() : "/workspace/" + project.getId();
            aiAgentClient.startAnalysis(
                    session.getId(), project.getId(), workspaceRoot,
                    "local", null, null, null, null,
                    settings.preferredModel(), settings.apiKey(), request.effectiveScanMode(),
                    request.fileFilter());
        }
    }

    @Transactional(readOnly = true)
    public Page<AnalysisSessionResponse> listSessions(UUID userId, UUID projectId, Pageable pageable) {
        if (!projectService.isMember(projectId, userId)) {
            throw new BusinessException(ErrorCode.PROJECT_ACCESS_DENIED);
        }
        return sessionRepository.findByProjectIdOrderByCreatedAtDesc(projectId, pageable)
                .map(AnalysisSessionResponse::from);
    }

    @Transactional(readOnly = true)
    public AnalysisSessionResponse getSession(UUID userId, UUID sessionId) {
        AnalysisSession session = sessionRepository.findByIdAndUserId(sessionId, userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.SESSION_NOT_FOUND));
        return AnalysisSessionResponse.from(session);
    }

    @Transactional
    public AnalysisSessionResponse resumeSession(UUID userId, UUID sessionId) {
        AnalysisSession session = sessionRepository.findByIdAndUserId(sessionId, userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.SESSION_NOT_FOUND));

        if (SessionStatus.INTERRUPTED != session.getStatus()) {
            throw new BusinessException(ErrorCode.SESSION_NOT_RESUMABLE);
        }

        session.markRunning();
        sessionRepository.save(session);
        aiAgentClient.resumeAnalysis(sessionId);
        log.info("[analysis] resumed sessionId={}", sessionId);
        return AnalysisSessionResponse.from(session);
    }

    @Transactional
    public void cancelSession(UUID userId, UUID sessionId) {
        AnalysisSession session = sessionRepository.findByIdAndUserId(sessionId, userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.SESSION_NOT_FOUND));

        if (SessionStatus.RUNNING != session.getStatus() && SessionStatus.PENDING != session.getStatus()) {
            throw new BusinessException(ErrorCode.SESSION_NOT_RESUMABLE);
        }

        session.setStatus(SessionStatus.CANCELLED);
        sessionRepository.save(session);
        aiAgentClient.cancelAnalysis(sessionId);
        log.info("[analysis] cancelled sessionId={}", sessionId);
    }
}
