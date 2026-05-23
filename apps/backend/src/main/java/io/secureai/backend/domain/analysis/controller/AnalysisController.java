package io.secureai.backend.domain.analysis.controller;

import io.secureai.backend.domain.analysis.dto.AnalysisSessionResponse;
import io.secureai.backend.domain.analysis.dto.StartAnalysisRequest;
import io.secureai.backend.domain.analysis.service.AnalysisService;
import io.secureai.backend.domain.analysis.service.SseEmitterService;
import io.secureai.backend.global.response.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
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
        AnalysisSessionResponse session;
        try {
            session = analysisService.getSession(userId, sessionId);
        } catch (Exception e) {
            // Content-Type이 text/event-stream으로 고정된 상태에서 예외를 GlobalExceptionHandler로
            // 넘기면 JSON 직렬화 실패(500)가 발생하므로 SSE error 이벤트로 직접 처리한다.
            log.warn("[sse] stream auth/session check failed sessionId={} err={}", sessionId, e.getMessage());
            SseEmitter error = new SseEmitter(0L);
            try {
                error.send(SseEmitter.event().name("error").data(e.getMessage()));
            } catch (IOException ignored) {}
            error.complete();
            return error;
        }

        // 캐시 히트 등으로 분석이 이미 완료된 경우 — pub/sub 이벤트가 유실됐을 수 있으므로
        // 즉시 completed 이벤트를 전송하고 연결을 닫는다.
        if ("completed".equals(session.status()) || "error".equals(session.status())) {
            SseEmitter immediate = new SseEmitter(0L);
            try {
                Map<String, Object> payload = Map.of(
                    "session_id", sessionId.toString(),
                    "type",       session.status(),
                    "vuln_count", session.vulnCount(),
                    "results",    List.of()   // 프론트엔드가 DB에서 로드
                );
                immediate.send(SseEmitter.event().name("progress").data(payload));
                log.info("[sse] late-connect replay sessionId={} status={}", sessionId, session.status());
            } catch (IOException ignored) {}
            immediate.complete();
            return immediate;
        }

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
