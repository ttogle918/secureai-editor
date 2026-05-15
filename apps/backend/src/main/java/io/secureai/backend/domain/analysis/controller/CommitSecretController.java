package io.secureai.backend.domain.analysis.controller;

import io.secureai.backend.domain.analysis.dto.CommitScanRequest;
import io.secureai.backend.domain.analysis.dto.CommitScanResponse;
import io.secureai.backend.domain.analysis.service.CommitSecretService;
import io.secureai.backend.global.response.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

/**
 * 커밋 히스토리 시크릿 스캔 컨트롤러.
 *
 * - POST  /api/v1/analysis/sessions/{sessionId}/scan-commits  — 스캔 트리거
 * - GET   /api/v1/analysis/sessions/{sessionId}/commit-secrets — 탐지된 시크릿 수 조회
 *
 * GitHub PAT는 X-GitHub-Token 헤더로 전달한다 (RequestBody에 포함 금지).
 * 헤더값은 로그에 절대 출력 금지.
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/analysis/sessions/{sessionId}")
public class CommitSecretController {

    private final CommitSecretService commitSecretService;

    /**
     * 커밋 히스토리 시크릿 스캔을 AI Engine에 위임한다.
     *
     * @param userId       인증된 사용자 ID
     * @param sessionId    분석 세션 UUID
     * @param githubToken  GitHub PAT (X-GitHub-Token 헤더, nullable)
     * @param req          스캔 파라미터
     */
    @PostMapping("/scan-commits")
    public ResponseEntity<ApiResponse<CommitScanResponse>> scanCommits(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID sessionId,
            @RequestHeader(value = "X-GitHub-Token", required = false) String githubToken,
            @Valid @RequestBody CommitScanRequest req
    ) {
        CommitScanResponse result = commitSecretService.triggerScan(userId, sessionId, req, githubToken);
        return ResponseEntity.status(HttpStatus.ACCEPTED)
                .body(ApiResponse.success(result));
    }

    /**
     * 세션에서 탐지된 시크릿 수를 반환한다.
     *
     * @param userId    인증된 사용자 ID
     * @param sessionId 분석 세션 UUID
     */
    @GetMapping("/commit-secrets")
    public ResponseEntity<ApiResponse<Map<String, Long>>> getCommitSecrets(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID sessionId
    ) {
        long count = commitSecretService.countSecrets(userId, sessionId);
        return ResponseEntity.ok(ApiResponse.success(Map.of("secretCount", count)));
    }
}
