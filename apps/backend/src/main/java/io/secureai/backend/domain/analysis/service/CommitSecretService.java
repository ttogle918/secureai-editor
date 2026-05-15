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
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.net.http.HttpClient;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * 커밋 히스토리 시크릿 스캔 서비스.
 *
 * 책임:
 * 1. 세션 소유권 및 GitHub 정보 검증
 * 2. AI Engine POST /agent/scan-commits 호출 (비동기 위임)
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

    private RestClient agentRestClient;

    /** AI Engine 내부 URL 주입 (순환 의존 방지를 위해 @Value 사용). */
    @Value("${secureai.ai-agent.url}")
    public void setAgentUrl(String agentUrl) {
        HttpClient httpClient = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .build();
        this.agentRestClient = RestClient.builder()
                .requestFactory(new JdkClientHttpRequestFactory(httpClient))
                .baseUrl(agentUrl)
                .build();
    }

    @Value("${secureai.internal-api-key}")
    private String internalApiKey;

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

        String status = callAgentScanCommits(sessionId, session.getProject().getId(), req, githubToken);

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

    private String callAgentScanCommits(
            UUID sessionId,
            UUID projectId,
            CommitScanRequest req,
            String githubToken
    ) {
        Map<String, Object> body = new HashMap<>();
        body.put("session_id", sessionId.toString());
        body.put("project_id", projectId.toString());
        body.put("owner", req.owner());
        body.put("repo", req.repo());
        body.put("per_page", req.perPage());
        if (req.ref() != null) {
            body.put("ref", req.ref());
        }
        // github_token은 로그에 절대 출력 금지
        if (githubToken != null) {
            body.put("github_token", githubToken);
        }
        if (req.preferredModel() != null) {
            body.put("preferred_model", req.preferredModel());
        }
        // user_api_key는 로그에 절대 출력 금지
        if (req.userApiKey() != null) {
            body.put("user_api_key", req.userApiKey());
        }

        try {
            agentRestClient.post()
                    .uri("/agent/scan-commits")
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("X-Internal-Key", internalApiKey)
                    .body(body)
                    .retrieve()
                    .toBodilessEntity();
            return "accepted";
        } catch (RestClientException e) {
            log.error("[commit-secret] AI Engine call failed sessionId={}: {}", sessionId, e.getMessage());
            return "error";
        }
    }
}
