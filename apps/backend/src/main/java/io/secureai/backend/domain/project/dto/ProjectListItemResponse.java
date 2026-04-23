package io.secureai.backend.domain.project.dto;

import io.secureai.backend.domain.project.entity.Project;
import lombok.Builder;
import lombok.Getter;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Builder
public class ProjectListItemResponse {

    private UUID id;
    private String name;
    private String language;
    private String framework;
    private String sourceType;
    private Short latestSecurityScore;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;

    public static ProjectListItemResponse from(Project project) {
        return ProjectListItemResponse.builder()
                .id(project.getId())
                .name(project.getName())
                .language(project.getLanguage())
                .framework(project.getFramework())
                .sourceType(project.getSourceType())
                .latestSecurityScore(project.getLatestSecurityScore())
                .createdAt(project.getCreatedAt())
                .updatedAt(project.getUpdatedAt())
                .build();
    }
}
