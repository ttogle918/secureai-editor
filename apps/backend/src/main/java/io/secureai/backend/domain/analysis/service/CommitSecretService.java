package io.secureai.backend.domain.analysis.service;

import io.secureai.backend.domain.analysis.dto.CommitScanRequest;
import io.secureai.backend.domain.analysis.dto.CommitScanResponse;
import io.secureai.backend.domain.analysis.entity.AnalysisSession;
import io.secureai.backend.domain.analysis.repository.AnalysisSessionRepository;
import io.secureai.backend.domain.analysis.repository.VulnerabilityRepository;
import io.secureai.backend.domain.project.repository.TeamMemberRepository;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * 커밋 히스토리 시크릿 스캔 서비스.
 *
 * 책임:
 * 1. 세션 소유권 및 GitHub 정보 검증
 * 2. AiAgentClient를 통해 AI Engine POST /agent/scan-commits 위임
 * 3. 세션에 저장된 SECRET_EXPOSURE 취약점 수 반환
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CommitSecretService {

    private static final String SECRET_VULN_TYPE = "SECRET_EXPOSURE";

    private final AnalysisSessionRepository sessionRepository;
    private final VulnerabilityRepository vulnerabilityRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final AiAgentClient aiAgentClient;

    /**
     * 커밋 히스토리 시크릿 스캔을 AI Engine에 위임한다.
     *
     * @param userId    요청 사용자 ID (소유권 검증용)
     * @param sessionId 대상 분석 세션 UUID
     * @param req       스캔 파라미터 (owner, repo, ref, perPage)
     * @param githubToken GitHub PAT — 로그 출력 금지
     * @return 스캔 트리거 결과 및 현재 시크릿 수
     */
    @Transactional(readOnly = true)
    public CommitScanResponse triggerScan(
            UUID userId,
            UUID sessionId,
            CommitScanRequest req,
            String githubToken
    ) {
        AnalysisSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new BusinessException(ErrorCode.SESSION_NOT_FOUND));

        boolean isMember = teamMemberRepository.existsByProjectIdAndUserId(
                session.getProject().getId(), userId);
        if (!isMember) {
            throw new BusinessException(ErrorCode.PROJECT_ACCESS_DENIED);
        }

        String status = delegateScanToAiEngine(sessionId, session.getProject().getId(), req, githubToken);

        long secretCount = vulnerabilityRepository.countBySessionIdAndVulnType(sessionId, SECRET_VULN_TYPE);

        log.info("[commit-secret] triggered sessionId={} owner={} repo={} status={}",
                sessionId, req.owner(), req.repo(), status);

        return new CommitScanResponse(sessionId, status, (int) secretCount);
    }

    /**
     * 세션에 저장된 시크릿 탐지 결과 목록을 반환한다.
     *
     * @param userId    요청 사용자 ID (소유권 검증용)
     * @param sessionId 대상 분석 세션 UUID
     * @return SECRET_EXPOSURE 유형 취약점 수
     */
    @Transactional(readOnly = true)
    public long countSecrets(UUID userId, UUID sessionId) {
        AnalysisSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new BusinessException(ErrorCode.SESSION_NOT_FOUND));

        boolean isMember = teamMemberRepository.existsByProjectIdAndUserId(
                session.getProject().getId(), userId);
        if (!isMember) {
            throw new BusinessException(ErrorCode.PROJECT_ACCESS_DENIED);
        }

        return vulnerabilityRepository.countBySessionIdAndVulnType(sessionId, SECRET_VULN_TYPE);
    }

    // ── 내부 헬퍼 ────────────────────────────────────────────────────────────

    private String delegateScanToAiEngine(
            UUID sessionId,
            UUID projectId,
            CommitScanRequest req,
            String githubToken
    ) {
        try {
            aiAgentClient.startCommitScan(sessionId, projectId, req, githubToken);
            return "accepted";
        } catch (BusinessException e) {
            log.error("[commit-secret] AI Engine call failed sessionId={}: {}", sessionId, e.getMessage());
            return "error";
        }
    }
}
