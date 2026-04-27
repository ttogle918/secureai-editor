package io.secureai.backend.domain.analysis.controller;

import io.secureai.backend.domain.analysis.dto.AnalysisSessionResponse;
import io.secureai.backend.domain.analysis.dto.StartAnalysisRequest;
import io.secureai.backend.domain.analysis.service.AnalysisService;
import io.secureai.backend.domain.analysis.service.SseEmitterService;
import io.secureai.backend.global.response.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/analysis")
@RequiredArgsConstructor
public class AnalysisController {

    private final AnalysisService analysisService;
    private final SseEmitterService sseEmitterService;

    @PostMapping("/sessions")
    public ResponseEntity<ApiResponse<AnalysisSessionResponse>> startAnalysis(
            @AuthenticationPrincipal UUID userId,
            @Valid @RequestBody StartAnalysisRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(analysisService.startAnalysis(userId, request)));
    }

    @GetMapping("/sessions")
    public ResponseEntity<ApiResponse<Page<AnalysisSessionResponse>>> listSessions(
            @AuthenticationPrincipal UUID userId,
            @RequestParam UUID projectId,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(ApiResponse.success(
                analysisService.listSessions(userId, projectId, pageable)));
    }

    @GetMapping("/sessions/{sessionId}")
    public ResponseEntity<ApiResponse<AnalysisSessionResponse>> getSession(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID sessionId) {
        return ResponseEntity.ok(ApiResponse.success(
                analysisService.getSession(userId, sessionId)));
    }

    /** SSE 구독 — 분석 진행 이벤트 실시간 수신 */
    @GetMapping(value = "/sessions/{sessionId}/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamSession(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID sessionId) {
        // 접근 권한 확인 (세션이 본인 것인지)
        analysisService.getSession(userId, sessionId);
        return sseEmitterService.subscribe(sessionId);
    }

    @PostMapping("/sessions/{sessionId}/resume")
    public ResponseEntity<ApiResponse<AnalysisSessionResponse>> resumeSession(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID sessionId) {
        return ResponseEntity.ok(ApiResponse.success(analysisService.resumeSession(userId, sessionId)));
    }

    @PostMapping("/sessions/{sessionId}/cancel")
    public ResponseEntity<Void> cancelSession(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID sessionId) {
        analysisService.cancelSession(userId, sessionId);
        return ResponseEntity.noContent().build();
    }
}
