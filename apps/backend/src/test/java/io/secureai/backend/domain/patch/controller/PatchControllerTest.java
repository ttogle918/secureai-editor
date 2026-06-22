package io.secureai.backend.domain.patch.controller;

import io.secureai.backend.domain.patch.dto.CreatePatchPrRequest;
import io.secureai.backend.domain.patch.dto.PatchExampleItem;
import io.secureai.backend.domain.patch.dto.PatchPrResponse;
import io.secureai.backend.domain.patch.dto.PatchSuggestionResponse;
import io.secureai.backend.domain.patch.dto.PatchVerificationRequest;
import io.secureai.backend.domain.patch.dto.SavePatchResultsRequest;
import io.secureai.backend.domain.patch.service.PatchPrService;
import io.secureai.backend.domain.patch.service.PatchService;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * PatchController 단위 테스트 — 내부(Agent) 저장/예시 조회와 인증 사용자용
 * 패치 목록/적용의 위임·상태코드를 검증한다.
 * TASK-1401: createPullRequest 엔드포인트 위임 및 오류 전파 테스트 포함.
 */
@ExtendWith(MockitoExtension.class)
class PatchControllerTest {

    @Mock PatchService patchService;
    @Mock PatchPrService patchPrService;

    private PatchController controller;

    @BeforeEach
    void setUp() {
        controller = new PatchController(patchService, patchPrService);
    }

    @Test
    @DisplayName("saveFromAgent — 저장 건수를 201 CREATED 의 saved 필드로 반환한다")
    void saveFromAgent_returns201WithCount() {
        SavePatchResultsRequest req = mock(SavePatchResultsRequest.class);
        when(patchService.savePatchResults(req)).thenReturn(2);

        var response = controller.saveFromAgent(req);

        assertThat(response.getStatusCode().value()).isEqualTo(201);
        assertThat(response.getBody().getData()).containsEntry("saved", 2);
    }

    @Test
    @DisplayName("getPatchExamples — vulnType + language 로 예시를 위임하고 200 을 반환한다")
    void getPatchExamples_delegates() {
        List<PatchExampleItem> examples = List.of(mock(PatchExampleItem.class));
        when(patchService.getPatchExamples("SQL_INJECTION", "java")).thenReturn(examples);

        var response = controller.getPatchExamples("SQL_INJECTION", "java");

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().getData()).hasSize(1);
        verify(patchService).getPatchExamples("SQL_INJECTION", "java");
    }

    @Test
    @DisplayName("listPatches — 세션별 패치 목록을 위임하고 200 을 반환한다")
    void listPatches_delegates() {
        UUID sessionId = UUID.randomUUID();
        List<PatchSuggestionResponse> patches = List.of(mock(PatchSuggestionResponse.class));
        when(patchService.listBySession(sessionId)).thenReturn(patches);

        var response = controller.listPatches(sessionId);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().getData()).hasSize(1);
    }

    @Test
    @DisplayName("applyPatch — userId + patchId 로 적용을 위임하고 200 을 반환한다")
    void applyPatch_delegates() {
        UUID userId = UUID.randomUUID();
        UUID patchId = UUID.randomUUID();
        PatchSuggestionResponse applied = mock(PatchSuggestionResponse.class);
        when(patchService.applyPatch(userId, patchId)).thenReturn(applied);

        var response = controller.applyPatch(userId, patchId);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().getData()).isSameAs(applied);
        verify(patchService).applyPatch(userId, patchId);
    }

    // -----------------------------------------------------------------------
    // TASK-1401: PR 생성 엔드포인트 테스트
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("createPullRequest — PatchPrService에 위임하고 200과 PatchPrResponse를 반환한다")
    void createPullRequest_delegates_and_returns200() {
        UUID userId = UUID.randomUUID();
        UUID patchId = UUID.randomUUID();
        CreatePatchPrRequest request = new CreatePatchPrRequest("octocat", "my-repo", null);
        PatchPrResponse prResponse = new PatchPrResponse(
                "https://github.com/octocat/my-repo/pull/42", 42, "secureai/patch-a1b2c3d4"
        );

        when(patchPrService.createPr(userId, patchId, request)).thenReturn(prResponse);

        var response = controller.createPullRequest(userId, patchId, request);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().getData().prNumber()).isEqualTo(42);
        assertThat(response.getBody().getData().prUrl()).contains("github.com");
        assertThat(response.getBody().getData().branchName()).startsWith("secureai/patch-");
        verify(patchPrService).createPr(userId, patchId, request);
    }

    @Test
    @DisplayName("createPullRequest — PATCH_ACCESS_DENIED 예외가 발생하면 그대로 전파된다")
    void createPullRequest_accessDenied_propagatesException() {
        UUID userId = UUID.randomUUID();
        UUID patchId = UUID.randomUUID();
        CreatePatchPrRequest request = new CreatePatchPrRequest("octocat", "my-repo", null);

        when(patchPrService.createPr(userId, patchId, request))
                .thenThrow(new BusinessException(ErrorCode.PATCH_ACCESS_DENIED));

        assertThatThrownBy(() -> controller.createPullRequest(userId, patchId, request))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getErrorCode())
                        .isEqualTo(ErrorCode.PATCH_ACCESS_DENIED));
    }

    @Test
    @DisplayName("createPullRequest — GITHUB_RATE_LIMIT_EXCEEDED 예외가 발생하면 그대로 전파된다")
    void createPullRequest_rateLimitExceeded_propagatesException() {
        UUID userId = UUID.randomUUID();
        UUID patchId = UUID.randomUUID();
        CreatePatchPrRequest request = new CreatePatchPrRequest("octocat", "my-repo", null);

        when(patchPrService.createPr(userId, patchId, request))
                .thenThrow(new BusinessException(ErrorCode.GITHUB_RATE_LIMIT_EXCEEDED));

        assertThatThrownBy(() -> controller.createPullRequest(userId, patchId, request))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getErrorCode())
                        .isEqualTo(ErrorCode.GITHUB_RATE_LIMIT_EXCEEDED));
    }

    // -----------------------------------------------------------------------
    // TASK-1402: 패치 검증 엔드포인트 테스트 (X-Internal-Key 전용)
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("reportVerification — VERIFIED 상태 보고를 PatchService에 위임하고 200을 반환한다")
    void reportVerification_verified_delegates_and_returns200() {
        UUID patchId = UUID.randomUUID();
        PatchVerificationRequest request = new PatchVerificationRequest("VERIFIED", "1 passed in 0.01s");

        doNothing().when(patchService).reportVerification(patchId, request);

        var response = controller.reportVerification(patchId, request);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        verify(patchService).reportVerification(patchId, request);
    }

    @Test
    @DisplayName("reportVerification — FAILED 상태 보고를 PatchService에 위임하고 200을 반환한다")
    void reportVerification_failed_delegates_and_returns200() {
        UUID patchId = UUID.randomUUID();
        PatchVerificationRequest request = new PatchVerificationRequest("FAILED", "SyntaxError: invalid syntax");

        doNothing().when(patchService).reportVerification(patchId, request);

        var response = controller.reportVerification(patchId, request);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        verify(patchService).reportVerification(patchId, request);
    }

    @Test
    @DisplayName("reportVerification — PATCH_NOT_FOUND 예외가 발생하면 그대로 전파된다")
    void reportVerification_patchNotFound_propagatesException() {
        UUID patchId = UUID.randomUUID();
        PatchVerificationRequest request = new PatchVerificationRequest("VERIFIED", null);

        doThrow(new BusinessException(ErrorCode.PATCH_NOT_FOUND))
                .when(patchService).reportVerification(patchId, request);

        assertThatThrownBy(() -> controller.reportVerification(patchId, request))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getErrorCode())
                        .isEqualTo(ErrorCode.PATCH_NOT_FOUND));
    }
}
