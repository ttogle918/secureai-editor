package io.secureai.backend.domain.workspace.controller;

import io.secureai.backend.domain.workspace.dto.WorkspaceTreeNode;
import io.secureai.backend.domain.workspace.dto.WorkspaceUploadRequest;
import io.secureai.backend.domain.workspace.dto.WorkspaceUploadResponse;
import io.secureai.backend.domain.workspace.service.WorkspaceService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * WorkspaceController 단위 테스트 — DastControllerTest 와 동일하게 MockMvc 없이
 * 컨트롤러 메서드를 직접 호출한다. 200/404 분기와 서비스 위임을 검증한다.
 */
@ExtendWith(MockitoExtension.class)
class WorkspaceControllerTest {

    @Mock WorkspaceService workspaceService;

    private WorkspaceController controller;

    private static final String WS_ID = "ws-123";

    @BeforeEach
    void setUp() {
        controller = new WorkspaceController(workspaceService);
    }

    // ── upload ──────────────────────────────────────────────────────────────

    @Test
    @DisplayName("upload — 서비스에 위임하고 workspaceId/projectName/fileCount 를 응답에 담는다")
    void upload_delegatesAndReturnsMetadata() {
        WorkspaceUploadRequest req = mock(WorkspaceUploadRequest.class);
        when(req.getProjectName()).thenReturn("my-proj");
        when(req.getFiles()).thenReturn(List.of(
                mock(WorkspaceUploadRequest.WorkspaceFile.class),
                mock(WorkspaceUploadRequest.WorkspaceFile.class)));
        when(workspaceService.upload(eq("my-proj"), anyList())).thenReturn(WS_ID);

        ResponseEntity<WorkspaceUploadResponse> response = controller.upload(req);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        WorkspaceUploadResponse body = response.getBody();
        assertThat(body).isNotNull();
        assertThat(body.getWorkspaceId()).isEqualTo(WS_ID);
        assertThat(body.getProjectName()).isEqualTo("my-proj");
        assertThat(body.getFileCount()).isEqualTo(2);
        assertThat(body.getExpiresInSeconds()).isEqualTo(86400);
        verify(workspaceService).upload(eq("my-proj"), anyList());
    }

    // ── getTree ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("getTree — 트리가 있으면 200")
    void getTree_found_returns200() {
        List<WorkspaceTreeNode> tree = List.of(mock(WorkspaceTreeNode.class));
        when(workspaceService.getTree(WS_ID)).thenReturn(tree);

        ResponseEntity<List<WorkspaceTreeNode>> response = controller.getTree(WS_ID);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).hasSize(1);
    }

    @Test
    @DisplayName("getTree — null 이면 404")
    void getTree_null_returns404() {
        when(workspaceService.getTree(WS_ID)).thenReturn(null);
        assertThat(controller.getTree(WS_ID).getStatusCode().value()).isEqualTo(404);
    }

    // ── getFile ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("getFile — 내용이 있으면 path/content 맵을 200으로 반환")
    void getFile_found_returnsContent() {
        when(workspaceService.getFileContent(WS_ID, "src/A.java")).thenReturn("class A {}");

        ResponseEntity<Map<String, String>> response = controller.getFile(WS_ID, "src/A.java");

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).containsEntry("path", "src/A.java")
                .containsEntry("content", "class A {}");
    }

    @Test
    @DisplayName("getFile — null 이면 404")
    void getFile_null_returns404() {
        when(workspaceService.getFileContent(WS_ID, "missing")).thenReturn(null);
        assertThat(controller.getFile(WS_ID, "missing").getStatusCode().value()).isEqualTo(404);
    }

    // ── exportFiles ───────────────────────────────────────────────────────────

    @Test
    @DisplayName("exportFiles — 파일 맵이 있으면 200")
    void exportFiles_found_returns200() {
        when(workspaceService.getAllFiles(WS_ID)).thenReturn(Map.of("a", "1"));
        assertThat(controller.exportFiles(WS_ID).getStatusCode().value()).isEqualTo(200);
    }

    @Test
    @DisplayName("exportFiles — null 이면 404")
    void exportFiles_null_returns404() {
        when(workspaceService.getAllFiles(WS_ID)).thenReturn(null);
        assertThat(controller.exportFiles(WS_ID).getStatusCode().value()).isEqualTo(404);
    }

    // ── getMeta ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("getMeta — 비어있지 않으면 200")
    void getMeta_present_returns200() {
        when(workspaceService.getMeta(WS_ID)).thenReturn(Map.of("projectName", "p"));
        assertThat(controller.getMeta(WS_ID).getStatusCode().value()).isEqualTo(200);
    }

    @Test
    @DisplayName("getMeta — 빈 맵이면 404")
    void getMeta_empty_returns404() {
        when(workspaceService.getMeta(WS_ID)).thenReturn(Map.of());
        assertThat(controller.getMeta(WS_ID).getStatusCode().value()).isEqualTo(404);
    }
}
