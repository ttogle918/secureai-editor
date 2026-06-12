package io.secureai.backend.domain.analysis.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.secureai.backend.config.GitHubConfig;
import io.secureai.backend.domain.analysis.entity.AnalysisSession;
import io.secureai.backend.domain.analysis.entity.PrReviewHistory;
import io.secureai.backend.domain.analysis.repository.AnalysisSessionRepository;
import io.secureai.backend.domain.analysis.repository.PrReviewHistoryRepository;
import io.secureai.backend.domain.project.entity.Project;
import io.secureai.backend.domain.project.repository.ProjectRepository;
import org.springframework.test.util.ReflectionTestUtils;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.*;

/**
 * GitHubWebhookService 단위 테스트.
 *
 * 외부 HTTP 호출(GitHub API, AI Engine)은 mock으로 격리한다.
 *
 * 설계 변경 반영:
 * - extractInstallationToken()은 현재 빈 문자열 반환
 * - 토큰이 blank이면 Check Run / 파일 조회를 skip (GitHub App 인증 플로우 미구현 상태)
 * - completeCheckRunAfterAnalysis는 비-blank 토큰을 받을 때만 API를 호출한다
 */
@ExtendWith(MockitoExtension.class)
class GitHubWebhookServiceTest {

    private static final String TEST_SECRET = "test-webhook-secret";
    private static final String TEST_PAYLOAD = "{\"action\":\"opened\",\"number\":42}";

    @Mock PrReviewHistoryRepository prReviewHistoryRepository;
    @Mock AiAgentClient aiAgentClient;
    @Mock GitHubConfig gitHubConfig;
    @Mock GitHubRestClient gitHubRestClient;
    @Mock GitHubAppAuthService gitHubAppAuthService;
    @Mock ProjectRepository projectRepository;
    @Mock AnalysisSessionRepository analysisSessionRepository;

    private GitHubWebhookService webhookService;
    private Mac testMac;

    @BeforeEach
    void setUp() throws Exception {
        // 테스트용 HMAC Mac 초기화
        testMac = Mac.getInstance("HmacSHA256");
        SecretKeySpec keySpec = new SecretKeySpec(
                TEST_SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256"
        );
        testMac.init(keySpec);

        webhookService = new GitHubWebhookService(
                testMac,
                gitHubConfig,
                prReviewHistoryRepository,
                aiAgentClient,
                gitHubRestClient,
                gitHubAppAuthService,
                projectRepository,
                analysisSessionRepository,
                new ObjectMapper()
        );

        // 분석 도달 테스트용: save 시 AnalysisSession에 id를 부여(영속 시뮬레이션) — getId() non-null 보장
        lenient().when(analysisSessionRepository.save(any(AnalysisSession.class))).thenAnswer(inv -> {
            AnalysisSession s = inv.getArgument(0);
            if (s.getId() == null) {
                ReflectionTestUtils.setField(s, "id", UUID.randomUUID());
            }
            return s;
        });
    }

    // ─── validateSignature 테스트 (기존 4개 — 회귀 없음) ────────────────────────

    @Test
    @DisplayName("올바른 HMAC-SHA256 서명으로 validateSignature 호출 시 예외 없이 통과한다")
    void validateSignature_validSignature_passes() {
        String signature = computeExpectedSignature(TEST_PAYLOAD);

        assertThatNoException()
                .isThrownBy(() -> webhookService.validateSignature(TEST_PAYLOAD, signature));
    }

    @Test
    @DisplayName("잘못된 서명으로 validateSignature 호출 시 GITHUB_WEBHOOK_INVALID 예외가 발생한다")
    void validateSignature_invalidSignature_throwsBusinessException() {
        String invalidSignature = "sha256=0000000000000000000000000000000000000000000000000000000000000000";

        assertThatThrownBy(() -> webhookService.validateSignature(TEST_PAYLOAD, invalidSignature))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> {
                    BusinessException be = (BusinessException) ex;
                    assertThat(be.getErrorCode()).isEqualTo(ErrorCode.GITHUB_WEBHOOK_INVALID);
                });
    }

    @Test
    @DisplayName("서명 헤더가 sha256= 접두사 없이 오면 GITHUB_WEBHOOK_INVALID 예외가 발생한다")
    void validateSignature_missingPrefix_throwsBusinessException() {
        String malformedSignature = "invalidhexvalue";

        assertThatThrownBy(() -> webhookService.validateSignature(TEST_PAYLOAD, malformedSignature))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> {
                    BusinessException be = (BusinessException) ex;
                    assertThat(be.getErrorCode()).isEqualTo(ErrorCode.GITHUB_WEBHOOK_INVALID);
                });
    }

    @Test
    @DisplayName("서명 헤더가 null이면 GITHUB_WEBHOOK_INVALID 예외가 발생한다")
    void validateSignature_nullHeader_throwsBusinessException() {
        assertThatThrownBy(() -> webhookService.validateSignature(TEST_PAYLOAD, null))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> {
                    BusinessException be = (BusinessException) ex;
                    assertThat(be.getErrorCode()).isEqualTo(ErrorCode.GITHUB_WEBHOOK_INVALID);
                });
    }

    // ─── handlePullRequest 테스트 ────────────────────────────────────────────

    @Test
    @DisplayName("action=opened인 PR Webhook 페이로드를 받으면 PrReviewHistory가 저장된다")
    void handlePullRequest_actionOpened_savesHistory() {
        Map<String, Object> payload = buildPrPayload("opened");
        when(gitHubAppAuthService.extractInstallationToken(any())).thenReturn("");
        when(projectRepository.findByGithubRepoFullName(anyString())).thenReturn(Optional.empty());
        when(prReviewHistoryRepository.save(any(PrReviewHistory.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        webhookService.handlePullRequest(payload);

        verify(prReviewHistoryRepository, times(1)).save(any(PrReviewHistory.class));
    }

    @Test
    @DisplayName("action=synchronize인 PR Webhook 페이로드를 받으면 PrReviewHistory가 저장된다")
    void handlePullRequest_actionSynchronize_savesHistory() {
        Map<String, Object> payload = buildPrPayload("synchronize");
        when(gitHubAppAuthService.extractInstallationToken(any())).thenReturn("");
        when(projectRepository.findByGithubRepoFullName(anyString())).thenReturn(Optional.empty());
        when(prReviewHistoryRepository.save(any(PrReviewHistory.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        webhookService.handlePullRequest(payload);

        verify(prReviewHistoryRepository, times(1)).save(any(PrReviewHistory.class));
    }

    @Test
    @DisplayName("action=closed인 PR Webhook 페이로드를 받으면 처리를 건너뛴다")
    void handlePullRequest_actionClosed_skipsProcessing() {
        Map<String, Object> payload = buildPrPayload("closed");

        webhookService.handlePullRequest(payload);

        // closed 이벤트는 저장 없이 바로 리턴
        verify(prReviewHistoryRepository, never()).save(any());
    }

    @Test
    @DisplayName("action=labeled인 PR Webhook 페이로드를 받으면 처리를 건너뛴다")
    void handlePullRequest_actionLabeled_skipsProcessing() {
        Map<String, Object> payload = buildPrPayload("labeled");

        webhookService.handlePullRequest(payload);

        verify(prReviewHistoryRepository, never()).save(any());
    }

    // ─── resolveProjectId 테스트 ─────────────────────────────────────────────

    @Test
    @DisplayName("projects 테이블에 매핑된 레포가 있으면 PrReviewHistory에 projectId가 저장된다")
    void handlePullRequest_projectFound_savesHistoryWithProjectId() {
        UUID expectedProjectId = UUID.randomUUID();
        Project mockProject = mock(Project.class);
        when(mockProject.getId()).thenReturn(expectedProjectId);

        when(projectRepository.findByGithubRepoFullName("testorg/testrepo"))
                .thenReturn(Optional.of(mockProject));
        // token 없음 — assignSession save 호출 없음 (1회)
        when(gitHubAppAuthService.extractInstallationToken(any())).thenReturn("");
        when(prReviewHistoryRepository.save(any(PrReviewHistory.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        Map<String, Object> payload = buildPrPayload("opened");
        webhookService.handlePullRequest(payload);

        // projectId가 expectedProjectId로 설정된 PrReviewHistory가 최소 1회 저장됨
        verify(prReviewHistoryRepository, atLeastOnce()).save(argThat(history ->
                expectedProjectId.equals(history.getProjectId())
        ));
    }

    @Test
    @DisplayName("projects 테이블에 매핑된 레포가 없으면 projectId=null로 PrReviewHistory가 저장된다")
    void handlePullRequest_projectNotFound_savesHistoryWithNullProjectId() {
        when(projectRepository.findByGithubRepoFullName("testorg/testrepo"))
                .thenReturn(Optional.empty());
        when(gitHubAppAuthService.extractInstallationToken(any())).thenReturn("");
        when(prReviewHistoryRepository.save(any(PrReviewHistory.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        Map<String, Object> payload = buildPrPayload("opened");
        webhookService.handlePullRequest(payload);

        // projectId=null로 저장 (매핑 없음 — 웹훅 이력은 유지)
        verify(prReviewHistoryRepository, times(1)).save(argThat(history ->
                history.getProjectId() == null
        ));
    }

    @Test
    @DisplayName("projects 테이블 조회 시 owner/repoName을 'owner/repoName' 형식으로 합성하여 조회한다")
    void handlePullRequest_callsRepositoryWithFullRepoName() {
        when(projectRepository.findByGithubRepoFullName("testorg/testrepo"))
                .thenReturn(Optional.empty());
        when(gitHubAppAuthService.extractInstallationToken(any())).thenReturn("");
        when(prReviewHistoryRepository.save(any(PrReviewHistory.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        Map<String, Object> payload = buildPrPayload("opened");
        webhookService.handlePullRequest(payload);

        // "testorg/testrepo" 형식으로 조회됐는지 확인
        verify(projectRepository, times(1)).findByGithubRepoFullName("testorg/testrepo");
    }

    // ─── Check Run / 토큰 가드 테스트 ────────────────────────────────────────────

    @Test
    @DisplayName("Installation Token 없을 때 PR opened 처리 시 Check Run 생성을 건너뛴다")
    void handlePullRequest_noInstallationToken_skipsCheckRun() {
        // given: extractInstallationToken()이 빈 문자열을 반환 (App 미설정)
        Map<String, Object> payload = buildPrPayload("opened");
        when(gitHubAppAuthService.extractInstallationToken(any())).thenReturn("");
        when(projectRepository.findByGithubRepoFullName(anyString())).thenReturn(Optional.empty());
        when(prReviewHistoryRepository.save(any(PrReviewHistory.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        // when
        webhookService.handlePullRequest(payload);

        // then: Check Run 생성은 호출되지 않아야 함 (토큰 없으면 skip & log)
        verify(gitHubRestClient, never()).createCheckRun(
                anyString(), anyString(), anyString(), anyString(), anyString(), anyString());
        // PrReviewHistory는 정상 저장
        verify(prReviewHistoryRepository, times(1)).save(any(PrReviewHistory.class));
    }

    @Test
    @DisplayName("Installation Token 없을 때 PR opened 처리 시 예외 없이 완료된다")
    void handlePullRequest_noInstallationToken_completesWithoutException() {
        Map<String, Object> payload = buildPrPayload("opened");
        when(gitHubAppAuthService.extractInstallationToken(any())).thenReturn("");
        when(projectRepository.findByGithubRepoFullName(anyString())).thenReturn(Optional.empty());
        when(prReviewHistoryRepository.save(any(PrReviewHistory.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        // Check Run 생성 skip이어도 분석 플로우가 멈추면 안 됨
        assertThatNoException()
                .isThrownBy(() -> webhookService.handlePullRequest(payload));

        verify(prReviewHistoryRepository, times(1)).save(any(PrReviewHistory.class));
    }

    @Test
    @DisplayName("Critical 취약점이 있고 토큰이 있을 때 completeCheckRunAfterAnalysis는 conclusion=failure로 호출한다")
    void completeCheckRunAfterAnalysis_criticalVulnsWithToken_conclusionIsFailure() {
        // given: Critical 취약점 3개, blockMergeOnCritical=true, 비-blank 토큰
        when(gitHubConfig.isBlockMergeOnCritical()).thenReturn(true);
        int vulnCount = 3;
        Long checkRunId = 42L;
        String token = "test-installation-token";  // 비-blank 토큰

        doNothing().when(gitHubRestClient).completeCheckRun(
                anyString(), anyString(), anyLong(), anyString(), anyString(), anyString());

        // when
        webhookService.completeCheckRunAfterAnalysis(
                "testorg", "testrepo", checkRunId, vulnCount, 7, token);

        // then: conclusion=failure로 완료 호출 확인
        verify(gitHubRestClient, times(1)).completeCheckRun(
                eq("testorg"), eq("testrepo"), eq(42L),
                eq("failure"), anyString(), eq(token)
        );
    }

    @Test
    @DisplayName("completeCheckRunAfterAnalysis는 토큰이 blank이면 Check Run / PR 코멘트를 건너뛴다")
    void completeCheckRunAfterAnalysis_blankToken_skipsAllApiCalls() {
        // given: 토큰 없음 (isBlockMergeOnCritical 호출 자체가 일어나지 않으므로 stub 불필요)

        // when: 빈 토큰으로 호출
        assertThatNoException()
                .isThrownBy(() -> webhookService.completeCheckRunAfterAnalysis(
                        "testorg", "testrepo", 42L, 3, 7, ""));

        // then: API 호출 없음
        verify(gitHubRestClient, never()).completeCheckRun(
                anyString(), anyString(), anyLong(), anyString(), anyString(), anyString());
        verify(gitHubRestClient, never()).createPrComment(
                anyString(), anyString(), anyInt(), anyString(), anyString());
    }

    // ─── TASK-1211: startAnalysis 디스패치 테스트 ─────────────────────────────

    @Test
    @DisplayName("projectId가 있고 token이 있을 때 startAnalysis(github, AUDIT)가 호출된다")
    void handlePullRequest_withProjectAndToken_startsAnalysis() {
        UUID projectId = UUID.randomUUID();
        Project mockProject = mock(Project.class);
        when(mockProject.getId()).thenReturn(projectId);
        when(projectRepository.findByGithubRepoFullName("testorg/testrepo"))
                .thenReturn(Optional.of(mockProject));
        when(projectRepository.findByIdWithOwner(projectId)).thenReturn(Optional.of(mockProject));
        when(gitHubAppAuthService.extractInstallationToken(any())).thenReturn("test-token");
        when(gitHubRestClient.createCheckRun(anyString(), anyString(), anyString(), anyString(), anyString(), anyString()))
                .thenReturn(new GitHubRestClient.CheckRunResponse(99L));
        when(gitHubRestClient.getPrChangedFiles(anyString(), anyString(), anyInt(), anyString()))
                .thenReturn(List.of("src/Foo.java", "src/Bar.java"));
        when(prReviewHistoryRepository.save(any(PrReviewHistory.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        webhookService.handlePullRequest(buildPrPayload("opened"));

        // startAnalysis(github, AUDIT, fileFilter) 호출 확인
        verify(aiAgentClient, times(1)).startAnalysis(
                any(UUID.class),       // sessionId
                eq(projectId),         // projectId
                isNull(),              // workspaceRoot=null
                eq("github"),          // sourceType
                eq("testorg"),         // owner
                eq("testrepo"),        // repoName
                eq("abc123def456abc123def456abc123def456abc1"), // headSha
                eq("test-token"),      // installationToken (로그 미노출)
                isNull(),              // preferredModel=null
                isNull(),              // userApiKey=null
                eq("AUDIT"),           // scanMode
                eq(List.of("src/Foo.java", "src/Bar.java")), // fileFilter
                isNull()               // preferredProvider=null (COST-4)
        );
    }

    @Test
    @DisplayName("projectId가 없으면 startAnalysis를 호출하지 않는다")
    void handlePullRequest_noProjectId_skipsAnalysis() {
        when(projectRepository.findByGithubRepoFullName("testorg/testrepo"))
                .thenReturn(Optional.empty());
        when(gitHubAppAuthService.extractInstallationToken(any())).thenReturn("");
        when(prReviewHistoryRepository.save(any(PrReviewHistory.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        webhookService.handlePullRequest(buildPrPayload("opened"));

        verify(aiAgentClient, never()).startAnalysis(
                any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("PrReviewHistory에 sessionId와 installationId가 저장된다")
    void handlePullRequest_withProject_savesSessionIdAndInstallationId() {
        UUID projectId = UUID.randomUUID();
        Project mockProject = mock(Project.class);
        when(mockProject.getId()).thenReturn(projectId);
        when(projectRepository.findByGithubRepoFullName("testorg/testrepo"))
                .thenReturn(Optional.of(mockProject));
        when(projectRepository.findByIdWithOwner(projectId)).thenReturn(Optional.of(mockProject));
        when(gitHubAppAuthService.extractInstallationToken(any())).thenReturn("test-token");
        when(gitHubRestClient.createCheckRun(anyString(), anyString(), anyString(), anyString(), anyString(), anyString()))
                .thenReturn(new GitHubRestClient.CheckRunResponse(99L));
        when(gitHubRestClient.getPrChangedFiles(anyString(), anyString(), anyInt(), anyString()))
                .thenReturn(List.of("src/Foo.java"));
        when(prReviewHistoryRepository.save(any(PrReviewHistory.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        Map<String, Object> payload = buildPrPayloadWithInstallation("opened", 12345L);
        webhookService.handlePullRequest(payload);

        // 두 번째 save(sessionId 저장) 시 sessionId != null + installationId == 12345
        ArgumentCaptor<PrReviewHistory> captor = ArgumentCaptor.forClass(PrReviewHistory.class);
        verify(prReviewHistoryRepository, atLeast(2)).save(captor.capture());
        PrReviewHistory lastSaved = captor.getAllValues().getLast();
        assertThat(lastSaved.getSessionId()).isNotNull();
        assertThat(lastSaved.getInstallationId()).isEqualTo(12345L);
    }

    @Test
    @DisplayName("token 없이 projectId가 있을 때 startAnalysis는 호출되지 않는다 (changedFiles 조회 불가)")
    void handlePullRequest_noToken_withProject_skipsAnalysis() {
        UUID projectId = UUID.randomUUID();
        Project mockProject = mock(Project.class);
        when(mockProject.getId()).thenReturn(projectId);
        when(projectRepository.findByGithubRepoFullName("testorg/testrepo"))
                .thenReturn(Optional.of(mockProject));
        when(gitHubAppAuthService.extractInstallationToken(any())).thenReturn("");
        when(prReviewHistoryRepository.save(any(PrReviewHistory.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        webhookService.handlePullRequest(buildPrPayload("opened"));

        // token 없으면 changedFiles 조회 자체가 skip되고 token이 blank이므로 startAnalysis 호출 안 됨
        verify(aiAgentClient, never()).startAnalysis(
                any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private String computeExpectedSignature(String payload) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            SecretKeySpec keySpec = new SecretKeySpec(
                    TEST_SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256"
            );
            mac.init(keySpec);
            byte[] hmac = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            return "sha256=" + HexFormat.of().formatHex(hmac);
        } catch (Exception e) {
            throw new RuntimeException("테스트 HMAC 계산 실패", e);
        }
    }

    private Map<String, Object> buildPrPayload(String action) {
        return buildPrPayloadWithInstallation(action, null);
    }

    private Map<String, Object> buildPrPayloadWithInstallation(String action, Long installationId) {
        Map<String, Object> head = new HashMap<>();
        head.put("sha", "abc123def456abc123def456abc123def456abc1");

        Map<String, Object> pr = new HashMap<>();
        pr.put("number", 42);
        pr.put("head", head);

        Map<String, Object> owner = new HashMap<>();
        owner.put("login", "testorg");

        Map<String, Object> repo = new HashMap<>();
        repo.put("name", "testrepo");
        repo.put("owner", owner);

        Map<String, Object> payload = new HashMap<>();
        payload.put("action", action);
        payload.put("pull_request", pr);
        payload.put("repository", repo);

        if (installationId != null) {
            Map<String, Object> installation = new HashMap<>();
            installation.put("id", installationId);
            payload.put("installation", installation);
        }

        return payload;
    }
}
