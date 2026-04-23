package io.secureai.backend.domain.project.dto;

import io.secureai.backend.domain.project.entity.Project;
import lombok.Builder;
import lombok.Getter;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Builder
public class ProjectResponse {

    private UUID id;
    private String name;
    private String description;
    private String language;
    private String framework;
    private String sourceType;
    private String githubRepoFullName;
    private String githubDefaultBranch;
    private Short latestSecurityScore;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;

    public static ProjectResponse from(Project project) {
        return ProjectResponse.builder()
                .id(project.getId())
                .name(project.getName())
                .description(project.getDescription())
                .language(project.getLanguage())
                .framework(project.getFramework())
                .sourceType(project.getSourceType())
                .githubRepoFullName(project.getGithubRepoFullName())
                .githubDefaultBranch(project.getGithubDefaultBranch())
                .latestSecurityScore(project.getLatestSecurityScore())
                .createdAt(project.getCreatedAt())
                .updatedAt(project.getUpdatedAt())
                .build();
    }
}
