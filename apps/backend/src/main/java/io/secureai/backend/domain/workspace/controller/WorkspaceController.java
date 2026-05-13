package io.secureai.backend.domain.workspace.controller;

import io.secureai.backend.domain.workspace.dto.WorkspaceTreeNode;
import io.secureai.backend.domain.workspace.dto.WorkspaceUploadRequest;
import io.secureai.backend.domain.workspace.dto.WorkspaceUploadResponse;
import io.secureai.backend.domain.workspace.service.WorkspaceService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/workspace")
@RequiredArgsConstructor
public class WorkspaceController {

    private final WorkspaceService workspaceService;

    /** 파일 업로드 — 브라우저가 읽은 파일 내용을 Redis에 저장 */
    @PostMapping
    public ResponseEntity<WorkspaceUploadResponse> upload(
            @Valid @RequestBody WorkspaceUploadRequest request) {

        String workspaceId = workspaceService.upload(request.getProjectName(), request.getFiles());
        return ResponseEntity.ok(WorkspaceUploadResponse.builder()
                .workspaceId(workspaceId)
                .projectName(request.getProjectName())
                .fileCount(request.getFiles().size())
                .expiresInSeconds(86400)
                .build());
    }

    /** 파일 트리 조회 */
    @GetMapping("/{workspaceId}/tree")
    public ResponseEntity<List<WorkspaceTreeNode>> getTree(@PathVariable String workspaceId) {
        List<WorkspaceTreeNode> tree = workspaceService.getTree(workspaceId);
        if (tree == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(tree);
    }

    /** 파일 내용 조회 */
    @GetMapping("/{workspaceId}/file")
    public ResponseEntity<Map<String, String>> getFile(
            @PathVariable String workspaceId,
            @RequestParam String path) {

        String content = workspaceService.getFileContent(workspaceId, path);
        if (content == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(Map.of("path", path, "content", content));
    }

    /** 전체 파일 일괄 내보내기 — AI Engine 내부 전용 */
    @GetMapping("/{workspaceId}/export")
    public ResponseEntity<Map<String, String>> exportFiles(@PathVariable String workspaceId) {
        Map<String, String> files = workspaceService.getAllFiles(workspaceId);
        if (files == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(files);
    }

    /** 워크스페이스 메타 조회 (projectName, fileCount) */
    @GetMapping("/{workspaceId}/meta")
    public ResponseEntity<Map<String, String>> getMeta(@PathVariable String workspaceId) {
        Map<String, String> meta = workspaceService.getMeta(workspaceId);
        if (meta.isEmpty()) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(meta);
    }
}
