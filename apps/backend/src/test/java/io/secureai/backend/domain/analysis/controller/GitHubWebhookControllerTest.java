package io.secureai.backend.domain.analysis.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.secureai.backend.domain.analysis.dto.PrReviewHistoryResponse;
import io.secureai.backend.domain.analysis.service.GitHubWebhookService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class GitHubWebhookControllerTest {

    @Mock GitHubWebhookService webhookService;

    private GitHubWebhookController controller;

    @BeforeEach
    void setUp() {
        controller = new GitHubWebhookController(webhookService, new ObjectMapper());
    }

    @Test
    @DisplayName("receiveWebhook — pull_request 이벤트는 서명 검증 후 payload 를 처리하고 202 를 반환한다")
    void receiveWebhook_pullRequest_validatesAndHandles() {
        String body = "{\"action\":\"opened\"}";

        var response = controller.receiveWebhook(body, "sha256=abc", "pull_request");

        assertThat(response.getStatusCode().value()).isEqualTo(202);
        verify(webhookService).validateSignature(body, "sha256=abc");
        verify(webhookService).handlePullRequest(any(Map.class));
    }

    @Test
    @DisplayName("receiveWebhook — 미지원 이벤트는 서명만 검증하고 처리하지 않은 채 202 를 반환한다")
    void receiveWebhook_unsupportedEvent_skipsHandling() {
        var response = controller.receiveWebhook("{}", "sha256=abc", "push");

        assertThat(response.getStatusCode().value()).isEqualTo(202);
        verify(webhookService).validateSignature("{}", "sha256=abc");
        verify(webhookService, never()).handlePullRequest(any());
    }

    @Test
    @DisplayName("getHistory — repoOwner/repoName/prNumber 로 PR 리뷰 이력을 위임한다")
    void getHistory_delegates() {
        UUID userId = UUID.randomUUID();
        List<PrReviewHistoryResponse> history = List.of(mock(PrReviewHistoryResponse.class));
        when(webhookService.getPrReviewHistory("octocat", "repo", 7)).thenReturn(history);

        var response = controller.getHistory(userId, "octocat", "repo", 7);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().getData()).hasSize(1);
    }
}
