package io.secureai.backend.domain.analysis.controller;

import io.secureai.backend.domain.analysis.dto.CommitScanRequest;
import io.secureai.backend.domain.analysis.dto.CommitScanResponse;
import io.secureai.backend.domain.analysis.service.CommitSecretService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CommitSecretControllerTest {

    @Mock CommitSecretService commitSecretService;

    private CommitSecretController controller;
    private final UUID userId = UUID.randomUUID();
    private final UUID sessionId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        controller = new CommitSecretController(commitSecretService);
    }

    @Test
    @DisplayName("scanCommits — GitHub 토큰 헤더와 요청을 위임하고 202 를 반환한다")
    void scanCommits_returns202() {
        CommitScanRequest req = mock(CommitScanRequest.class);
        CommitScanResponse result = mock(CommitScanResponse.class);
        when(commitSecretService.triggerScan(userId, sessionId, req, "ghp_token")).thenReturn(result);

        var response = controller.scanCommits(userId, sessionId, "ghp_token", req);

        assertThat(response.getStatusCode().value()).isEqualTo(202);
        assertThat(response.getBody().getData()).isSameAs(result);
    }

    @Test
    @DisplayName("getCommitSecrets — 탐지된 시크릿 수를 secretCount 로 반환한다")
    void getCommitSecrets_returnsCount() {
        when(commitSecretService.countSecrets(userId, sessionId)).thenReturn(5L);

        var response = controller.getCommitSecrets(userId, sessionId);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().getData()).containsEntry("secretCount", 5L);
    }
}
