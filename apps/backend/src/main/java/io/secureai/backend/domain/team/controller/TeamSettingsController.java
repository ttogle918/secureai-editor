package io.secureai.backend.domain.team.controller;

import io.secureai.backend.domain.team.dto.IpAllowlistRequest;
import io.secureai.backend.domain.team.service.TeamSettingsService;
import io.secureai.backend.global.response.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * 팀 설정 관리 API — 관리자 전용.
 * PUT /api/v1/admin/teams/{teamId}/ip-allowlist: IP 허용 목록 업데이트
 */
@RestController
@RequestMapping("/api/v1/admin/teams")
@RequiredArgsConstructor
public class TeamSettingsController {

    private final TeamSettingsService teamSettingsService;

    @PutMapping("/{teamId}/ip-allowlist")
    @PreAuthorize("@adminGuard.check(authentication)")
    public ResponseEntity<ApiResponse<Void>> updateIpAllowlist(
            @PathVariable UUID teamId,
            @Valid @RequestBody IpAllowlistRequest request) {

        teamSettingsService.updateIpAllowlist(teamId, request.allowedIpRanges());
        return ResponseEntity.ok(ApiResponse.success(null));
    }
}
