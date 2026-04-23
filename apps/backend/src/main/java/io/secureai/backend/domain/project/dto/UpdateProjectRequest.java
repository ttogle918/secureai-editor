package io.secureai.backend.domain.project.dto;

import jakarta.validation.constraints.Size;
import lombok.Getter;

@Getter
public class UpdateProjectRequest {

    @Size(max = 200)
    private String name;

    @Size(max = 2000)
    private String description;
}
