package io.secureai.backend.domain.analysis.service;

import io.secureai.backend.domain.analysis.dto.CommitScanRequest;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public interface AiAgentClient {
    void startAnalysis(UUID sessionId, UUID projectId, String workspaceRoot);

    void startAnalysis(
            UUID sessionId,
            UUID projectId,
            String workspaceRoot,
            String sourceType,
            String githubOwner,
            String githubRepo,
            String githubRef,
            String githubToken,
            String preferredModel,
            String userApiKey,
            String scanMode,
            List<String> fileFilter,
            String preferredProvider
    );

    void resumeAnalysis(UUID sessionId);

    void cancelAnalysis(UUID sessionId);

    boolean isCircuitOpen();

    String translate(String text, String targetLang, String userApiKey);

    /** DAST 분석을 AI Engine에 위임한다. */
    void startDast(UUID sessionId, UUID vulnId, String vulnType,
                   String targetUrl, String endpoint, Map<String, Object> params);

    /** 커밋 시크릿 스캔을 AI Engine에 위임한다. githubToken은 로그 출력 금지. */
    void startCommitScan(UUID sessionId, UUID projectId, CommitScanRequest req, String githubToken);

    /**
     * STAGE-2: 사용자 컨펌 후 AI Engine에 계획 확정을 전달하고 재개를 요청한다.
     *
     * @param sessionId          분석 세션 ID
     * @param selectedStageNos   포함할 stage 번호 목록 (null = 전체)
     * @param excludedFilePaths  제외할 파일 경로 목록
     */
    void confirmPlan(UUID sessionId, List<Integer> selectedStageNos, List<String> excludedFilePaths);
}
