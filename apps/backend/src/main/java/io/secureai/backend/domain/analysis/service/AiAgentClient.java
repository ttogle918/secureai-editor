package io.secureai.backend.domain.analysis.service;

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
            String githubToken
    );

    void resumeAnalysis(UUID sessionId);

    void cancelAnalysis(UUID sessionId);

    boolean isCircuitOpen();
}
