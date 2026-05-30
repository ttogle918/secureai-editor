package io.secureai.backend.domain.analysis.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import java.util.List;
import java.util.UUID;

public record StartAnalysisRequest(
        @NotNull UUID projectId,
        String workspaceRoot,           // local 전용 (nullable)
        String sourceType,              // "local" | "github", default "local"
        String githubRepoUrl,           // "https://github.com/owner/repo" (github 전용)
        String githubRef,               // branch/tag/commit (nullable, default: 레포 기본 브랜치)
        Boolean force,                  // true 시 진행 중 세션을 중단하고 새 세션 시작
        @Pattern(regexp = "^(AUDIT|PIPELINE)$", message = "scanMode는 AUDIT 또는 PIPELINE 이어야 합니다.")
        String scanMode,                // "AUDIT" | "PIPELINE" (nullable, default: "PIPELINE")
        List<String> fileFilter         // 선택 분석 — null/빈 값 = 전체 (TASK-1106, 하위 호환)
) {
    /** 하위 호환 생성자 — fileFilter 미지정(전체 분석). 기존 7-인자 호출부 호환. */
    public StartAnalysisRequest(UUID projectId, String workspaceRoot, String sourceType,
                                String githubRepoUrl, String githubRef, Boolean force, String scanMode) {
        this(projectId, workspaceRoot, sourceType, githubRepoUrl, githubRef, force, scanMode, null);
    }

    public String effectiveSourceType() {
        return sourceType != null ? sourceType : "local";
    }

    public boolean isForce() {
        return Boolean.TRUE.equals(force);
    }

    public String effectiveScanMode() {
        return scanMode != null ? scanMode : "PIPELINE";
    }
}
