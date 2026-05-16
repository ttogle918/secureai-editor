package io.secureai.backend.domain.dast.controller;

import io.secureai.backend.domain.dast.dto.DastExecuteRequest;
import io.secureai.backend.domain.dast.dto.DastExecuteResponse;
import io.secureai.backend.domain.dast.dto.DastResultDto;
import io.secureai.backend.domain.dast.dto.DastStartRequest;
import io.secureai.backend.domain.dast.service.DastExecutionService;
import io.secureai.backend.domain.dast.service.DastResultQueryService;
import io.secureai.backend.domain.dast.service.DomainVerificationService;
import io.secureai.backend.global.aop.AuditLog;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import io.secureai.backend.global.response.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * DAST 관련 REST 엔드포인트.
 * - /api/v1/internal/dast/execute : AI Engine 전용 내부 엔드포인트
 *   (InternalKeyAuthFilter 가 X-Internal-Key 헤더 검증 — SecurityConfig에서 permitAll)
 * - /api/v1/dast/start            : Frontend → Backend DAST 시작 요청
 * - /api/v1/dast/results/{id}     : DAST 결과 조회
 */
@Slf4j
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class DastController {

    private static final Set<String> LOCALHOST_DOMAINS = Set.of("localhost", "127.0.0.1", "0.0.0.0");

    private final DastExecutionService dastExecutionService;
    private final DastResultQueryService dastResultQueryService;
    private final DomainVerificationService domainVerificationService;

    // ── 내부 엔드포인트 (AI Engine → Backend) ────────────────────────────────

    /**
     * AI Engine이 호출하는 DAST 익스플로잇 실행 엔드포인트.
     * X-Internal-Key 헤더 검증은 InternalKeyAuthFilter(글로벌 필터)가 담당한다.
     * targetUrl, params 는 절대 로그에 출력하지 않는다.
     */
    @PostMapping("/internal/dast/execute")
    public ResponseEntity<DastExecuteResponse> executeInSandbox(
            @Valid @RequestBody DastExecuteRequest req
    ) {
        log.info("DAST execute requested: vulnType={} vulnId={}", req.vulnType(), req.vulnId());
        DastExecuteResponse response = dastExecutionService.execute(req);
        return ResponseEntity.ok(response);
    }

    // ── 공개 엔드포인트 (Frontend → Backend) ─────────────────────────────────

    /**
     * DAST 스캔 시작 요청.
     * 도메인 소유권 확인 + Rate Limit + 분산 락을 검증한 뒤 AI Engine에 위임한다.
     * consentGiven 이 false 이면 즉시 403을 반환한다.
     */
    @AuditLog(action = "DAST_START", resource = "dast")
    @PostMapping("/dast/start")
    public ResponseEntity<Void> startDast(
            @AuthenticationPrincipal UUID userId,
            @Valid @RequestBody DastStartRequest req,
            HttpServletRequest httpReq
    ) {
        if (!req.consentGiven()) {
            throw new BusinessException(ErrorCode.DAST_CONSENT_REQUIRED,
                    "consentGiven 이 true 여야 합니다.");
        }

        String clientIp = resolveClientIp(httpReq);
        boolean isLocalhost = LOCALHOST_DOMAINS.contains(req.domain());

        log.info("DAST start requested: sessionId={} vulnId={} domain={}",
                req.sessionId(), req.vulnId(), req.domain());

        // localhost/127.0.0.1 은 개발/데모 환경 — 도메인 소유권 검증 생략
        if (!isLocalhost) {
            if (userId == null) {
                throw new BusinessException(ErrorCode.USER_NOT_FOUND, "인증 정보가 유효하지 않습니다.");
            }
            domainVerificationService.assertDastAllowed(userId, req.domain(), clientIp);
        }

        dastExecutionService.initiateDastScan(req);
        return ResponseEntity.accepted().build();
    }

    /**
     * 세션 ID에 속한 DAST 익스플로잇 결과를 JSON DTO로 조회한다.
     */
    @GetMapping("/dast/results/{sessionId}")
    public ResponseEntity<ApiResponse<List<DastResultDto>>> getResults(
            @PathVariable UUID sessionId
    ) {
        List<DastResultDto> results = dastResultQueryService.getResultsBySessionId(sessionId)
                .stream()
                .filter(r -> r.getVulnId() != null)
                .map(DastResultDto::from)
                .toList();
        return ResponseEntity.ok(ApiResponse.success(results));
    }

    /**
     * 취약점 ID로 최신 DAST 결과를 단건 조회한다.
     */
    @GetMapping("/dast/results/vuln/{vulnId}")
    public ResponseEntity<ApiResponse<DastResultDto>> getResultByVulnId(
            @PathVariable UUID vulnId
    ) {
        return dastResultQueryService.getLatestResultByVulnId(vulnId)
                .map(DastResultDto::from)
                .map(dto -> ResponseEntity.ok(ApiResponse.success(dto)))
                .orElse(ResponseEntity.ok(ApiResponse.success(null)));
    }

    /**
     * vulnId 목록으로 각 취약점의 최신 완료 DAST 결과를 일괄 조회한다.
     * 세션 ID와 독립적이므로 새로고침 후에도 결과 복원 가능.
     */
    @PostMapping("/dast/results/by-vuln-ids")
    public ResponseEntity<ApiResponse<List<DastResultDto>>> getResultsByVulnIds(
            @RequestBody List<UUID> vulnIds
    ) {
        List<DastResultDto> results = dastResultQueryService.getLatestCompletedByVulnIds(vulnIds)
                .stream().map(DastResultDto::from).toList();
        return ResponseEntity.ok(ApiResponse.success(results));
    }

    // ── private helpers ───────────────────────────────────────────────────────

    /**
     * 요청 IP를 추출한다. clientIp 는 법적 증거 보존 데이터이므로 로그에 출력하지 않는다.
     */
    private String resolveClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
