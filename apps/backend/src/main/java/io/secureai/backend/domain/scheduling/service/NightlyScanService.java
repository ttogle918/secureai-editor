package io.secureai.backend.domain.scheduling.service;

import io.secureai.backend.domain.analysis.repository.AnalysisSessionRepository;
import io.secureai.backend.domain.analysis.service.AiAgentClient;
import io.secureai.backend.domain.auth.service.EmailService;
import io.secureai.backend.domain.notification.service.SlackNotificationPort;
import io.secureai.backend.domain.project.entity.Project;
import io.secureai.backend.domain.project.repository.ProjectRepository;
import io.secureai.backend.domain.scheduling.entity.ProjectSchedule;
import io.secureai.backend.domain.scheduling.repository.ProjectScheduleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

/**
 * 야간 자동 스캔 핵심 로직 서비스.
 *
 * <p>SRP: 스케줄 목록 순회, 변경 감지, 스캔 트리거, 알림 발송을 담당한다.
 * 스케줄 실행 시점 결정은 {@link NightlyScanJob}에 위임한다.
 *
 * <p>도메인 격리 원칙 주의:
 * {@link ProjectRepository}를 {@code domain/scheduling}에서 직접 주입하는 것은
 * 도메인 간 직접 의존 금지 원칙에 위배될 수 있다.
 * MVP 범위에서 허용하며, 향후 ApplicationEvent 기반(ProjectScheduleQueryEvent)으로
 * 전환할 예정이다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class NightlyScanService {

    /** GitHub URL이 없는 프로젝트의 재스캔 기준 — 마지막 스캔으로부터 경과 일수. */
    private static final long RESCAN_THRESHOLD_DAYS = 30L;

    private final ProjectScheduleRepository projectScheduleRepository;

    // TODO(향후): ApplicationEvent 기반으로 전환하여 도메인 간 직접 의존 제거
    private final ProjectRepository projectRepository;
    private final AnalysisSessionRepository analysisSessionRepository;

    private final AiAgentClient aiAgentClient;
    private final SlackNotificationPort slackNotificationPort;
    private final EmailService emailService;

    /**
     * 활성화된 모든 스케줄을 순회하며 야간 스캔을 수행한다.
     *
     * <p>개별 프로젝트 스캔 실패 시 skip &amp; log — 전체 배치 실패 금지.
     */
    @Transactional
    public void scanActiveProjects() {
        List<ProjectSchedule> schedules = projectScheduleRepository.findAllByIsActiveTrue();
        log.info("[nightly-scan] 활성 스케줄 수={}", schedules.size());

        for (ProjectSchedule schedule : schedules) {
            try {
                processSingleSchedule(schedule);
            } catch (Exception e) {
                // 개별 프로젝트 실패 시 skip & log — 전체 배치 중단 금지 (general.md 규칙)
                log.error("[nightly-scan] 프로젝트 스캔 실패 projectId={} cause={}",
                        schedule.getProjectId(), e.getMessage(), e);
            }
        }
    }

    private void processSingleSchedule(ProjectSchedule schedule) {
        UUID projectId = schedule.getProjectId();

        Project project = projectRepository.findById(projectId).orElse(null);
        if (project == null) {
            log.warn("[nightly-scan] 프로젝트를 찾을 수 없음 projectId={} — 스케줄 스킵", projectId);
            return;
        }

        if (!hasChanged(schedule, project)) {
            log.info("[nightly-scan] 변경 없음 — 스캔 스킵 projectId={}", projectId);
            return;
        }

        triggerScan(project, schedule);
    }

    /**
     * 프로젝트에 변경이 있는지 확인한다.
     *
     * <p>GitHub URL이 있으면 최신 세션의 SHA와 lastScanSha를 비교한다.
     * GitHub URL이 없으면 마지막 스캔으로부터 {@link #RESCAN_THRESHOLD_DAYS}일 이상 경과했는지 확인한다.
     */
    boolean hasChanged(ProjectSchedule schedule, Project project) {
        if (project.getGithubRepoFullName() != null && !project.getGithubRepoFullName().isBlank()) {
            return hasGithubCommitChanged(schedule, project);
        }
        return hasExceededRescanThreshold(schedule);
    }

    private boolean hasGithubCommitChanged(ProjectSchedule schedule, Project project) {
        // 최신 분석 세션의 SHA를 lastScanSha와 비교
        // 세션 createdAt을 새 SHA 대용으로 사용 (실제 커밋 SHA는 AI Engine이 관리)
        String latestSessionId = analysisSessionRepository
                .findTopByProjectIdOrderByCreatedAtDesc(project.getId())
                .map(session -> session.getId().toString())
                .orElse(null);

        if (latestSessionId == null) {
            // 분석 이력 없음 — 최초 스캔 필요
            return true;
        }

        // lastScanSha가 null이면 아직 한 번도 야간 스캔을 하지 않은 것 → 스캔 필요
        if (schedule.getLastScanSha() == null) {
            return true;
        }

        // 마지막 야간 스캔 이후 새 세션이 생성된 경우 → 변경 있음
        return !schedule.getLastScanSha().equals(latestSessionId);
    }

    private boolean hasExceededRescanThreshold(ProjectSchedule schedule) {
        Instant lastScanAt = schedule.getLastScanAt();
        if (lastScanAt == null) {
            return true;
        }
        long daysSinceScan = ChronoUnit.DAYS.between(lastScanAt, Instant.now());
        return daysSinceScan >= RESCAN_THRESHOLD_DAYS;
    }

    /**
     * AI Engine에 분석을 요청하고 결과를 Slack/이메일로 알린다.
     *
     * <p>알림 실패 시 skip &amp; log — 스캔 자체의 성공 여부에 영향을 주지 않는다.
     */
    void triggerScan(Project project, ProjectSchedule schedule) {
        UUID sessionId = UUID.randomUUID();
        log.info("[nightly-scan] 스캔 트리거 projectId={} sessionId={}", project.getId(), sessionId);

        aiAgentClient.startAnalysis(sessionId, project.getId(), "");

        // 스캔 완료 후 마지막 스캔 정보 업데이트
        String newScanSha = sessionId.toString();
        schedule.setLastScanSha(newScanSha);
        schedule.setLastScanAt(Instant.now());
        projectScheduleRepository.save(schedule);

        String summary = "야간 자동 스캔 완료 (sessionId=" + sessionId + ")";
        notifySlack(project.getName(), summary);
        notifyEmail(project, summary);

        log.info("[nightly-scan] 스캔 완료 projectId={} sessionId={}", project.getId(), sessionId);
    }

    private void notifySlack(String projectName, String summary) {
        try {
            slackNotificationPort.sendNightlyScanResult(projectName, summary);
        } catch (Exception e) {
            // 알림 실패 시 skip & log — 스캔 결과에 영향 없음
            log.warn("[nightly-scan] Slack 알림 실패 project={} cause={}", projectName, e.getMessage());
        }
    }

    private void notifyEmail(Project project, String summary) {
        try {
            String ownerEmail = project.getOwner().getEmail();
            emailService.sendNightlyScanResultEmail(ownerEmail, project.getName(), summary);
        } catch (Exception e) {
            // 알림 실패 시 skip & log — 스캔 결과에 영향 없음
            log.warn("[nightly-scan] 이메일 알림 실패 projectId={} cause={}", project.getId(), e.getMessage());
        }
    }
}
