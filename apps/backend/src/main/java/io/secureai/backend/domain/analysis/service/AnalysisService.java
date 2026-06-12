package io.secureai.backend.domain.analysis.service;

import io.secureai.backend.domain.analysis.dto.AnalysisSessionResponse;
import io.secureai.backend.domain.analysis.dto.StartAnalysisRequest;
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
    private final ProviderKeyService providerKeyService;
    private final TokenUsageService tokenUsageService;
    private final AnalysisMetrics analysisMetrics;

    @Transactional
    public AnalysisSessionResponse startAnalysis(UUID userId, StartAnalysisRequest request) {
        Project project = projectService.findOrThrow(request.projectId());
        if (!projectService.isMember(request.projectId(), userId)) {
            throw new BusinessException(ErrorCode.PROJECT_ACCESS_DENIED);
        }

        handleRunningSession(request.projectId(), request.isForce());

        // COST-3: 월 토큰 한도 가드 — BYOK 세션은 제외
        // BYOK 판정: user_provider_keys 또는 legacy anthropic_api_key 보유 시 플랫폼 과금 없음
        UserService.UserAnalysisSettings settings = userService.getAnalysisSettings(userId);
        boolean isByok = providerKeyService.resolveKeyForAnalysis(
                userId, settings.preferredProvider()).apiKey() != null;
        if (!isByok && tokenUsageService.isMonthlyLimitExceeded(userId)) {
            log.warn("[analysis] monthly token limit exceeded userId={}", userId);
            throw new BusinessException(ErrorCode.TOKEN_LIMIT_EXCEEDED);
        }

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
        // COST-4: provider 키 해결 (fallback 포함)
        ProviderKeyService.ResolvedKey resolved =
                providerKeyService.resolveKeyForAnalysis(userId, settings.preferredProvider());
        String resolvedProvider = resolved.provider();
        String resolvedApiKey   = resolved.apiKey() != null ? resolved.apiKey() : settings.apiKey();

        // COST-3: userId를 body에 포함하여 세션 종료 시 토큰 사용량 콜백에 활용
        // DefaultAiAgentClient.startAnalysisWithUser 를 직접 캐스팅하여 호출한다.
        // AiAgentClient 인터페이스 시그니처는 변경하지 않는다.
        if (aiAgentClient instanceof DefaultAiAgentClient defaultClient) {
            if ("github".equalsIgnoreCase(request.effectiveSourceType())) {
                GitHubApiService.GithubRepoInfo info =
                        gitHubApiService.resolveAndValidate(userId, request.githubRepoUrl(), request.githubRef());
                defaultClient.startAnalysisWithUser(
                        session.getId(), project.getId(), null,
                        "github", info.owner(), info.repo(), info.ref(), info.token(),
                        settings.preferredModel(), resolvedApiKey, request.effectiveScanMode(),
                        request.fileFilter(), resolvedProvider, userId);
            } else {
                String workspaceRoot = request.workspaceRoot() != null
                        ? request.workspaceRoot() : "/workspace/" + project.getId();
                defaultClient.startAnalysisWithUser(
                        session.getId(), project.getId(), workspaceRoot,
                        "local", null, null, null, null,
                        settings.preferredModel(), resolvedApiKey, request.effectiveScanMode(),
                        request.fileFilter(), resolvedProvider, userId);
            }
        } else {
            // 테스트 mock 등 비DefaultAiAgentClient 구현: userId 없이 기존 인터페이스 사용
            if ("github".equalsIgnoreCase(request.effectiveSourceType())) {
                GitHubApiService.GithubRepoInfo info =
                        gitHubApiService.resolveAndValidate(userId, request.githubRepoUrl(), request.githubRef());
                aiAgentClient.startAnalysis(
                        session.getId(), project.getId(), null,
                        "github", info.owner(), info.repo(), info.ref(), info.token(),
                        settings.preferredModel(), resolvedApiKey, request.effectiveScanMode(),
                        request.fileFilter(), resolvedProvider);
            } else {
                String workspaceRoot = request.workspaceRoot() != null
                        ? request.workspaceRoot() : "/workspace/" + project.getId();
                aiAgentClient.startAnalysis(
                        session.getId(), project.getId(), workspaceRoot,
                        "local", null, null, null, null,
                        settings.preferredModel(), resolvedApiKey, request.effectiveScanMode(),
                        request.fileFilter(), resolvedProvider);
            }
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
