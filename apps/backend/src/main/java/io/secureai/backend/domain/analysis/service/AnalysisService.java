package io.secureai.backend.domain.analysis.service;

import io.secureai.backend.domain.analysis.dto.AnalysisSessionResponse;
import io.secureai.backend.domain.analysis.dto.StartAnalysisRequest;
import io.secureai.backend.domain.analysis.entity.AnalysisSession;
import io.secureai.backend.domain.analysis.repository.AnalysisSessionRepository;
import io.secureai.backend.domain.project.entity.Project;
import io.secureai.backend.domain.project.repository.ProjectRepository;
import io.secureai.backend.domain.project.repository.TeamMemberRepository;
import io.secureai.backend.domain.user.entity.User;
import io.secureai.backend.domain.user.repository.UserRepository;
import io.secureai.backend.domain.user.service.UserService;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
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
    private final ProjectRepository projectRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final UserRepository userRepository;
    private final AiAgentClient aiAgentClient;
    private final GitHubApiService gitHubApiService;
    private final UserService userService;

    @Transactional
    public AnalysisSessionResponse startAnalysis(UUID userId, StartAnalysisRequest request) {
        Project project = projectRepository.findById(request.projectId())
                .orElseThrow(() -> new BusinessException(ErrorCode.PROJECT_NOT_FOUND));

        if (!teamMemberRepository.existsByProjectIdAndUserId(request.projectId(), userId)) {
            throw new BusinessException(ErrorCode.PROJECT_ACCESS_DENIED);
        }

        if (sessionRepository.existsByProjectIdAndStatus(request.projectId(), "running")) {
            if (!request.isForce()) {
                throw new BusinessException(ErrorCode.SESSION_ALREADY_RUNNING);
            }
            // force=true: 진행 중 세션을 interrupted 처리 후 새 세션 시작
            sessionRepository.findAllRunning().stream()
                    .filter(s -> s.getProject().getId().equals(request.projectId()))
                    .forEach(s -> sessionRepository.markInterrupted(s.getId()));
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));

        AnalysisSession session = AnalysisSession.builder()
                .project(project)
                .user(user)
                .build();
        sessionRepository.save(session);

        session.markRunning();
        sessionRepository.save(session);

        // 사용자 모델 설정 및 BYOK 키 조회 (분석 전 해결)
        UserService.UserAnalysisSettings settings = userService.getAnalysisSettings(userId);

        // AI Agent 비동기 호출 (Virtual Thread 에서 실행)
        if ("github".equalsIgnoreCase(request.effectiveSourceType())) {
            GitHubApiService.GithubRepoInfo info = gitHubApiService.resolveAndValidate(userId, request.githubRepoUrl(),
                    request.githubRef());
            // 토큰은 로그에 출력 금지
            aiAgentClient.startAnalysis(
                    session.getId(), project.getId(), null,
                    "github", info.owner(), info.repo(), info.ref(), info.token(),
                    settings.preferredModel(), settings.apiKey());
        } else {
            String workspaceRoot = request.workspaceRoot() != null
                    ? request.workspaceRoot()
                    : "/workspace/" + project.getId();
            aiAgentClient.startAnalysis(
                    session.getId(), project.getId(), workspaceRoot,
                    "local", null, null, null, null,
                    settings.preferredModel(), settings.apiKey());
        }

        log.info("[analysis] started sessionId={} projectId={} sourceType={}",
                session.getId(), project.getId(), request.effectiveSourceType());
        return AnalysisSessionResponse.from(session);
    }

    @Transactional(readOnly = true)
    public Page<AnalysisSessionResponse> listSessions(UUID userId, UUID projectId, Pageable pageable) {
        if (!teamMemberRepository.existsByProjectIdAndUserId(projectId, userId)) {
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

        if (!"interrupted".equals(session.getStatus())) {
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

        if (!"running".equals(session.getStatus()) && !"pending".equals(session.getStatus())) {
            throw new BusinessException(ErrorCode.SESSION_NOT_RESUMABLE);
        }

        session.setStatus("cancelled");
        sessionRepository.save(session);
        aiAgentClient.cancelAnalysis(sessionId);
        log.info("[analysis] cancelled sessionId={}", sessionId);
    }
}
