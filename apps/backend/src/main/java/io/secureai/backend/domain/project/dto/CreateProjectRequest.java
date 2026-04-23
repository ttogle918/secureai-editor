package io.secureai.backend.domain.project.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;

@Getter
public class CreateProjectRequest {

    @NotBlank
    @Size(max = 200)
    private String name;

    @Size(max = 2000)
    private String description;

    @NotBlank
    @Pattern(regexp = "^(local|github|url)$", message = "sourceType은 local, github, url 중 하나여야 합니다.")
    private String sourceType;

    @Size(max = 200)
    private String githubRepoFullName;

    @Size(max = 100)
    private String githubDefaultBranch;
}
