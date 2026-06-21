package io.secureai.backend.domain.patch.controller;

import io.secureai.backend.domain.patch.dto.CreatePatchPrRequest;
import io.secureai.backend.domain.patch.dto.PatchExampleItem;
import io.secureai.backend.domain.patch.dto.PatchPrResponse;
import io.secureai.backend.domain.patch.dto.PatchSuggestionResponse;
import io.secureai.backend.domain.patch.dto.SavePatchResultsRequest;
import io.secureai.backend.domain.patch.service.PatchPrService;
import io.secureai.backend.domain.patch.service.PatchService;
import io.secureai.backend.global.response.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class PatchController {

    private final PatchService patchService;
    private final PatchPrService patchPrService;

    /** AI Engine → Backend 내부 엔드포인트 (X-Internal-Key 인증) */
    @PostMapping("/api/v1/internal/patches")
    public ResponseEntity<ApiResponse<Map<String, Integer>>> saveFromAgent(
            @Valid @RequestBody SavePatchResultsRequest request) {
        int saved = patchService.savePatchResults(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(Map.of("saved", saved)));
    }

    /**
     * AI Engine 컨텍스트용 이전 패치 예시 조회 (최대 3건).
     * X-Internal-Key 인증 (InternalKeyAuthFilter), JWT 불필요.
     *
     * <p>프로젝트와 무관하게 vulnType + language 조합으로 전역 패턴을 조회한다.
     * ADR-016: MCP PostgreSQL f-string SQL 대체 엔드포인트.
     * JPQL 파라미터 바인딩으로 SQL Injection 방어.
     *
     * @param vulnType 취약점 유형 (SQL_INJECTION 등)
     * @param language 파일 확장자 없는 언어 식별자 (java, python, javascript 등)
     */
    @GetMapping("/api/v1/internal/patch-examples")
    public ResponseEntity<ApiResponse<List<PatchExampleItem>>> getPatchExamples(
            @RequestParam String vulnType,
            @RequestParam String language) {
        List<PatchExampleItem> examples = patchService.getPatchExamples(vulnType, language);
        return ResponseEntity.ok(ApiResponse.success(examples));
    }

    /** 세션별 패치 제안 목록 조회 (인증 필요) */
    @GetMapping("/api/v1/sessions/{sessionId}/patches")
    public ResponseEntity<ApiResponse<List<PatchSuggestionResponse>>> listPatches(
            @PathVariable UUID sessionId) {
        return ResponseEntity.ok(ApiResponse.success(patchService.listBySession(sessionId)));
    }

    /** 패치 적용 처리 (인증 필요) */
    @PostMapping("/api/v1/patches/{patchId}/apply")
    public ResponseEntity<ApiResponse<PatchSuggestionResponse>> applyPatch(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID patchId) {
        return ResponseEntity.ok(ApiResponse.success(patchService.applyPatch(userId, patchId)));
    }

    /**
     * 패치 → GitHub PR 생성 (JWT 인증 필요).
     *
     * 입력 검증은 Controller 레이어에서만 수행 (general.md 보안 규칙).
     * patchId 소유 검증은 PatchPrService에서 수행한다.
     * auto-merge 절대 금지 — PR-only.
     *
     * @param userId    JWT에서 추출한 사용자 ID
     * @param patchId   패치 제안 ID
     * @param request   PR 생성 요청 ({owner, repo, baseBranch?})
     * @return PatchPrResponse ({prUrl, prNumber, branchName})
     */
    @PostMapping("/api/v1/patches/{patchId}/pull-request")
    public ResponseEntity<ApiResponse<PatchPrResponse>> createPullRequest(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID patchId,
            @Valid @RequestBody CreatePatchPrRequest request) {
        PatchPrResponse response = patchPrService.createPr(userId, patchId, request);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
