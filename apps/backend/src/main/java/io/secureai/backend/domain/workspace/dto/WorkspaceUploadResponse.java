package io.secureai.backend.domain.workspace.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class WorkspaceUploadResponse {
    private String workspaceId;
    private String projectName;
    private int fileCount;
    private long expiresInSeconds;
}
