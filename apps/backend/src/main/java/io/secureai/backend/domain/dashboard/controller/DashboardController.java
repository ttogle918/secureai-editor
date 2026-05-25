package io.secureai.backend.domain.dashboard.controller;

import io.secureai.backend.domain.dashboard.dto.DashboardResponse;
import io.secureai.backend.domain.dashboard.dto.TeamDashboardResponse;
import io.secureai.backend.domain.dashboard.service.DashboardQueryService;
import io.secureai.backend.domain.dashboard.service.TeamDashboardService;
import io.secureai.backend.global.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardQueryService dashboardQueryService;
    private final TeamDashboardService teamDashboardService;

    /**
     * 프로젝트 대시보드 집계 데이터 조회.
     * Redis에 5분 TTL로 캐시되며 프로젝트 멤버만 접근할 수 있다.
     */
    @GetMapping("/api/v1/projects/{projectId}/dashboard")
    public ResponseEntity<ApiResponse<DashboardResponse>> getDashboard(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID projectId) {
        DashboardResponse response = dashboardQueryService.getDashboard(userId, projectId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    /**
     * 팀(조직) 대시보드 집계 데이터 조회.
     * 팀 멤버만 접근할 수 있으며, 멤버별 보안 점수와 gamification rank를 포함한다.
     */
    @GetMapping("/api/v1/teams/{teamId}/dashboard")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<TeamDashboardResponse>> getTeamDashboard(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID teamId) {
        TeamDashboardResponse response = teamDashboardService.getTeamDashboard(teamId, userId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
