package io.secureai.backend.domain.scheduling.controller;

import io.secureai.backend.domain.scheduling.dto.ProjectScheduleRequest;
import io.secureai.backend.domain.scheduling.dto.ProjectScheduleResponse;
import io.secureai.backend.domain.scheduling.service.ProjectScheduleService;
import io.secureai.backend.global.response.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * 프로젝트 야간 자동 스캔 스케줄 관리 API.
 *
 * <p>PUT  /api/v1/projects/{projectId}/schedule — 스케줄 활성화/수정 (Upsert)
 * <p>GET  /api/v1/projects/{projectId}/schedule — 스케줄 조회
 */
@RestController
@RequestMapping("/api/v1/projects/{projectId}/schedule")
@RequiredArgsConstructor
public class ProjectScheduleController {

    private final ProjectScheduleService projectScheduleService;

    @GetMapping
    public ResponseEntity<ApiResponse<ProjectScheduleResponse>> getSchedule(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID projectId) {
        return ResponseEntity.ok(
                ApiResponse.success(projectScheduleService.getSchedule(userId, projectId)));
    }

    @PutMapping
    public ResponseEntity<ApiResponse<ProjectScheduleResponse>> upsertSchedule(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID projectId,
            @Valid @RequestBody ProjectScheduleRequest request) {
        return ResponseEntity.ok(
                ApiResponse.success(projectScheduleService.upsertSchedule(userId, projectId, request)));
    }
}
