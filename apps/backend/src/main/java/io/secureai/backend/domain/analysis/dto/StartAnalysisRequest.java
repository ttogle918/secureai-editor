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
        List<String> fileFilter,        // 선택 분석 — null/빈 값 = 전체 (TASK-1106, 하위 호환)
        /** STAGE-2: 계획 확정 게이트 활성화 여부. "DETERMINISTIC"|"LLM", default "DETERMINISTIC". */
        String planningMode,
        /** STAGE-2: true 시 planning_node 후 사용자 컨펌 게이트 활성화. */
        Boolean confirmGate,
        /**
         * FEAT-BILLING-2: 키 사용 모드. "BYOK" | "PLATFORM" | null(자동).
         * PLATFORM 이면 BYOK 키가 등록돼 있어도 무시하고 플랫폼 키 + 크레딧 차감을 사용한다.
         */
        String keyMode
) {
    /** 하위 호환 생성자 — fileFilter/planningMode/confirmGate/keyMode 미지정(전체 분석). 기존 7-인자 호출부 호환. */
    public StartAnalysisRequest(UUID projectId, String workspaceRoot, String sourceType,
                                String githubRepoUrl, String githubRef, Boolean force, String scanMode) {
        this(projectId, workspaceRoot, sourceType, githubRepoUrl, githubRef, force, scanMode, null, null, null, null);
    }

    /** 하위 호환 생성자 — planningMode/confirmGate/keyMode 미지정. 기존 8-인자 호출부 호환. */
    public StartAnalysisRequest(UUID projectId, String workspaceRoot, String sourceType,
                                String githubRepoUrl, String githubRef, Boolean force, String scanMode,
                                List<String> fileFilter) {
        this(projectId, workspaceRoot, sourceType, githubRepoUrl, githubRef, force, scanMode, fileFilter, null, null, null);
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

    /** STAGE-2: 플래닝 모드. null 이면 "DETERMINISTIC". */
    public String effectivePlanningMode() {
        return planningMode != null ? planningMode : "DETERMINISTIC";
    }

    /** STAGE-2: 사용자 컨펌 게이트 활성화 여부. */
    public boolean isConfirmGate() {
        return Boolean.TRUE.equals(confirmGate);
    }

    /** FEAT-BILLING-2: 플랫폼 키 + 크레딧 강제 모드 여부(BYOK 키 무시). */
    public boolean isPlatformMode() {
        return "PLATFORM".equalsIgnoreCase(keyMode);
    }
}
