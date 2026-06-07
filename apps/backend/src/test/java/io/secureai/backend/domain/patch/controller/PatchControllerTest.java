package io.secureai.backend.domain.patch.controller;

import io.secureai.backend.domain.patch.dto.PatchExampleItem;
import io.secureai.backend.domain.patch.dto.PatchSuggestionResponse;
import io.secureai.backend.domain.patch.dto.SavePatchResultsRequest;
import io.secureai.backend.domain.patch.service.PatchService;
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
 */
@ExtendWith(MockitoExtension.class)
class PatchControllerTest {

    @Mock PatchService patchService;

    private PatchController controller;

    @BeforeEach
    void setUp() {
        controller = new PatchController(patchService);
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
}
