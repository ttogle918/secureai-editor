package io.secureai.backend.domain.workspace.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.List;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorkspaceTreeNode {
    private String name;
    private String path;
    private String type; // "file" | "dir"
    private List<WorkspaceTreeNode> children;
}
