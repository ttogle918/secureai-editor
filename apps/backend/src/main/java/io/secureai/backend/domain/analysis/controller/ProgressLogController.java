package io.secureai.backend.domain.analysis.controller;

import io.secureai.backend.domain.analysis.dto.ProgressLogResponse;
import io.secureai.backend.domain.analysis.dto.SaveProgressLogRequest;
import io.secureai.backend.domain.analysis.service.ProgressLogService;
import io.secureai.backend.global.response.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class ProgressLogController {

    private final ProgressLogService progressLogService;

    /** AI Agent → Backend 내부 엔드포인트 (X-Internal-Key 인증) */
    @PostMapping("/api/v1/internal/progress-logs")
    public ResponseEntity<ApiResponse<ProgressLogResponse>> saveLog(
            @Valid @RequestBody SaveProgressLogRequest request) {
        ProgressLogResponse response = progressLogService.log(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(response));
    }

    /** 세션 진행 로그 목록 조회 (인증 필요) */
    @GetMapping("/api/v1/analysis/sessions/{sessionId}/progress-logs")
    public ResponseEntity<ApiResponse<List<ProgressLogResponse>>> getProgressLogs(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID sessionId) {
        return ResponseEntity.ok(ApiResponse.success(
                progressLogService.getBySessionId(userId, sessionId)));
    }
}
