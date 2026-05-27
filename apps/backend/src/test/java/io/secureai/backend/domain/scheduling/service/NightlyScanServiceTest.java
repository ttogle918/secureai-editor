package io.secureai.backend.domain.scheduling.service;

import io.secureai.backend.domain.analysis.entity.AnalysisSession;
import io.secureai.backend.domain.analysis.repository.AnalysisSessionRepository;
import io.secureai.backend.domain.analysis.service.AiAgentClient;
import io.secureai.backend.domain.auth.service.EmailService;
import io.secureai.backend.domain.notification.service.SlackNotificationPort;
import io.secureai.backend.domain.project.entity.Project;
import io.secureai.backend.domain.project.repository.ProjectRepository;
import io.secureai.backend.domain.scheduling.entity.ProjectSchedule;
import io.secureai.backend.domain.scheduling.repository.ProjectScheduleRepository;
import io.secureai.backend.domain.user.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.*;

/**
 * NightlyScanService 단위 테스트.
 *
 * @MockitoSettings(LENIENT): @BeforeEach에서 공통으로 선언된 project/owner stub이
 * 일부 테스트(hasChanged 직접 호출)에서 사용되지 않을 수 있어 LENIENT로 설정.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class NightlyScanServiceTest {

    @Mock
    ProjectScheduleRepository projectScheduleRepository;

    @Mock
    ProjectRepository projectRepository;

    @Mock
    AnalysisSessionRepository analysisSessionRepository;

    @Mock
    AiAgentClient aiAgentClient;

    @Mock
    SlackNotificationPort slackNotificationPort;

    @Mock
    EmailService emailService;

    @InjectMocks
    NightlyScanService nightlyScanService;

    private UUID projectId;
    private Project project;
    private User owner;

    @BeforeEach
    void setUp() {
        projectId = UUID.randomUUID();

        owner = mock(User.class);
        given(owner.getEmail()).willReturn("owner@example.com");

        project = mock(Project.class);
        given(project.getId()).willReturn(projectId);
        given(project.getName()).willReturn("TestProject");
        given(project.getOwner()).willReturn(owner);
        given(project.getGithubRepoFullName()).willReturn(null); // GitHub URL 없음
    }

    @Test
    @DisplayName("활성 스케줄 없을 때 triggerScan 호출 없음")
    void scanActiveProjects_활성스케줄없음_triggerScan미호출() {
        given(projectScheduleRepository.findAllByIsActiveTrue()).willReturn(List.of());

        nightlyScanService.scanActiveProjects();

        verify(aiAgentClient, never()).startAnalysis(any(), any(), any());
    }

    @Test
    @DisplayName("hasChanged=true인 프로젝트는 AiAgentClient 호출")
    void scanActiveProjects_변경있음_aiAgentClient호출() {
        ProjectSchedule schedule = ProjectSchedule.builder()
                .projectId(projectId)
                .isActive(true)
                .lastScanAt(null) // 한 번도 스캔 안 함 → hasChanged=true
                .build();

        given(projectScheduleRepository.findAllByIsActiveTrue()).willReturn(List.of(schedule));
        given(projectRepository.findById(projectId)).willReturn(Optional.of(project));
        given(projectScheduleRepository.save(any())).willReturn(schedule);

        nightlyScanService.scanActiveProjects();

        verify(aiAgentClient).startAnalysis(any(UUID.class), eq(projectId), eq(""));
    }

    @Test
    @DisplayName("개별 프로젝트 스캔 실패 시 예외 삼킴 + 나머지 계속 진행")
    void scanActiveProjects_개별실패_예외삼킴_나머지진행() {
        UUID projectId2 = UUID.randomUUID();
        Project project2 = mock(Project.class);
        given(project2.getId()).willReturn(projectId2);
        given(project2.getName()).willReturn("AnotherProject");
        given(project2.getOwner()).willReturn(owner);
        given(project2.getGithubRepoFullName()).willReturn(null);

        ProjectSchedule schedule1 = ProjectSchedule.builder()
                .projectId(projectId)
                .isActive(true)
                .lastScanAt(null)
                .build();

        ProjectSchedule schedule2 = ProjectSchedule.builder()
                .projectId(projectId2)
                .isActive(true)
                .lastScanAt(null)
                .build();

        given(projectScheduleRepository.findAllByIsActiveTrue()).willReturn(List.of(schedule1, schedule2));
        given(projectRepository.findById(projectId)).willReturn(Optional.of(project));
        given(projectRepository.findById(projectId2)).willReturn(Optional.of(project2));

        // 첫 번째 프로젝트 AiAgentClient 호출 시 예외 발생
        doThrow(new RuntimeException("AI Engine 연결 실패"))
                .when(aiAgentClient).startAnalysis(any(UUID.class), eq(projectId), anyString());

        // 두 번째 프로젝트는 정상 처리
        given(projectScheduleRepository.save(any())).willReturn(schedule2);

        nightlyScanService.scanActiveProjects();

        // 두 번째 프로젝트는 정상적으로 AiAgentClient 호출되어야 함
        verify(aiAgentClient).startAnalysis(any(UUID.class), eq(projectId2), eq(""));
    }

    @Test
    @DisplayName("30일 이내 스캔한 GitHub 없는 프로젝트는 triggerScan 미호출")
    void scanActiveProjects_30일이내스캔_스킵() {
        ProjectSchedule schedule = ProjectSchedule.builder()
                .projectId(projectId)
                .isActive(true)
                .lastScanAt(Instant.now().minusSeconds(86400)) // 1일 전 스캔
                .build();

        given(projectScheduleRepository.findAllByIsActiveTrue()).willReturn(List.of(schedule));
        given(projectRepository.findById(projectId)).willReturn(Optional.of(project));

        nightlyScanService.scanActiveProjects();

        verify(aiAgentClient, never()).startAnalysis(any(), any(), any());
    }

    @Test
    @DisplayName("hasChanged - GitHub 없고 30일 이상 경과 시 true 반환")
    void hasChanged_GitHub없음_30일경과_true() {
        ProjectSchedule schedule = ProjectSchedule.builder()
                .projectId(projectId)
                .lastScanAt(Instant.now().minus(31, ChronoUnit.DAYS))
                .build();

        boolean result = nightlyScanService.hasChanged(schedule, project);

        assertThat(result).isTrue();
    }

    @Test
    @DisplayName("hasChanged - GitHub 없고 lastScanAt null이면 true 반환")
    void hasChanged_GitHub없음_lastScanAt_null_true() {
        ProjectSchedule schedule = ProjectSchedule.builder()
                .projectId(projectId)
                .lastScanAt(null)
                .build();

        boolean result = nightlyScanService.hasChanged(schedule, project);

        assertThat(result).isTrue();
    }

    @Test
    @DisplayName("hasChanged - GitHub 있고 분석 이력 없으면 true 반환")
    void hasChanged_GitHub있음_분석이력없음_true() {
        Project githubProject = mock(Project.class);
        given(githubProject.getId()).willReturn(projectId);
        given(githubProject.getGithubRepoFullName()).willReturn("myorg/myrepo");

        given(analysisSessionRepository.findTopByProjectIdOrderByCreatedAtDesc(projectId))
                .willReturn(Optional.empty());

        ProjectSchedule schedule = ProjectSchedule.builder()
                .projectId(projectId)
                .lastScanSha(null)
                .build();

        boolean result = nightlyScanService.hasChanged(schedule, githubProject);

        assertThat(result).isTrue();
    }

    @Test
    @DisplayName("hasChanged - GitHub 있고 lastScanSha와 최신 세션 ID 동일하면 false 반환")
    void hasChanged_GitHub있음_SHA동일_false() {
        Project githubProject = mock(Project.class);
        given(githubProject.getId()).willReturn(projectId);
        given(githubProject.getGithubRepoFullName()).willReturn("myorg/myrepo");

        UUID sessionId = UUID.randomUUID();
        AnalysisSession session = mock(AnalysisSession.class);
        given(session.getId()).willReturn(sessionId);

        given(analysisSessionRepository.findTopByProjectIdOrderByCreatedAtDesc(projectId))
                .willReturn(Optional.of(session));

        ProjectSchedule schedule = ProjectSchedule.builder()
                .projectId(projectId)
                .lastScanSha(sessionId.toString()) // 동일한 SHA
                .build();

        boolean result = nightlyScanService.hasChanged(schedule, githubProject);

        assertThat(result).isFalse();
    }

    @Test
    @DisplayName("Slack 알림 실패해도 스캔 완료 처리됨")
    void triggerScan_Slack실패_스캔완료() {
        ProjectSchedule schedule = ProjectSchedule.builder()
                .projectId(projectId)
                .isActive(true)
                .build();

        given(projectScheduleRepository.save(any())).willReturn(schedule);
        doThrow(new RuntimeException("Slack 연결 실패"))
                .when(slackNotificationPort).sendNightlyScanResult(anyString(), anyString());

        nightlyScanService.triggerScan(project, schedule);

        // AiAgentClient는 호출되어야 함
        verify(aiAgentClient).startAnalysis(any(UUID.class), eq(projectId), eq(""));
        // 스케줄 업데이트는 되어야 함
        verify(projectScheduleRepository).save(schedule);
    }
}
