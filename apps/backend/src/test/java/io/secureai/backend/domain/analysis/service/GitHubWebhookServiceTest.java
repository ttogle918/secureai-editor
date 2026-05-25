package io.secureai.backend.domain.analysis.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.secureai.backend.config.GitHubConfig;
import io.secureai.backend.domain.analysis.entity.PrReviewHistory;
import io.secureai.backend.domain.analysis.repository.PrReviewHistoryRepository;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
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
                new ObjectMapper()
        );
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
        when(prReviewHistoryRepository.save(any(PrReviewHistory.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        webhookService.handlePullRequest(payload);

        verify(prReviewHistoryRepository, times(1)).save(any(PrReviewHistory.class));
    }

    @Test
    @DisplayName("action=synchronize인 PR Webhook 페이로드를 받으면 PrReviewHistory가 저장된다")
    void handlePullRequest_actionSynchronize_savesHistory() {
        Map<String, Object> payload = buildPrPayload("synchronize");
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

    // ─── Check Run / 토큰 가드 테스트 ────────────────────────────────────────────

    @Test
    @DisplayName("Installation Token 없을 때 PR opened 처리 시 Check Run 생성을 건너뛴다")
    void handlePullRequest_noInstallationToken_skipsCheckRun() {
        // given: extractInstallationToken()은 항상 ""를 반환 (GitHub App 미구현)
        Map<String, Object> payload = buildPrPayload("opened");
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

        return payload;
    }
}
