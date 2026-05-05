package io.secureai.backend.domain.workspace.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;

import java.util.List;

@Getter
public class WorkspaceUploadRequest {

    @NotBlank
    @Size(max = 200)
    private String projectName;

    @NotNull
    @Valid
    private List<WorkspaceFile> files;

    @Getter
    public static class WorkspaceFile {
        @NotBlank
        private String path;

        @NotNull
        private String content;
    }
}
