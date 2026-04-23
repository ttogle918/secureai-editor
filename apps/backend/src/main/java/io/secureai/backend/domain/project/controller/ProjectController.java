package io.secureai.backend.domain.project.controller;

import io.secureai.backend.domain.project.dto.*;
import io.secureai.backend.domain.project.service.ProjectService;
import io.secureai.backend.global.aop.AuditLog;
import io.secureai.backend.global.response.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/projects")
@RequiredArgsConstructor
public class ProjectController {

    private final ProjectService projectService;

    @GetMapping
    public ResponseEntity<ApiResponse<Page<ProjectListItemResponse>>> listProjects(
            @AuthenticationPrincipal UUID userId,
            @PageableDefault(size = 20, sort = "updatedAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(ApiResponse.success(projectService.listProjects(userId, pageable)));
    }

    @PostMapping
    @AuditLog(action = "CREATE_PROJECT", resource = "project")
    public ResponseEntity<ApiResponse<ProjectResponse>> createProject(
            @AuthenticationPrincipal UUID userId,
            @Valid @RequestBody CreateProjectRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(projectService.createProject(userId, request)));
    }

    @GetMapping("/{projectId}")
    public ResponseEntity<ApiResponse<ProjectResponse>> getProject(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID projectId) {
        return ResponseEntity.ok(ApiResponse.success(projectService.getProject(userId, projectId)));
    }

    @PutMapping("/{projectId}")
    @AuditLog(action = "UPDATE_PROJECT", resource = "project")
    public ResponseEntity<ApiResponse<ProjectResponse>> updateProject(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID projectId,
            @Valid @RequestBody UpdateProjectRequest request) {
        return ResponseEntity.ok(ApiResponse.success(projectService.updateProject(userId, projectId, request)));
    }

    @DeleteMapping("/{projectId}")
    @AuditLog(action = "DELETE_PROJECT", resource = "project")
    public ResponseEntity<Void> deleteProject(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID projectId) {
        projectService.deleteProject(userId, projectId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{projectId}/members")
    public ResponseEntity<ApiResponse<List<TeamMemberResponse>>> listMembers(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID projectId) {
        return ResponseEntity.ok(ApiResponse.success(projectService.listMembers(userId, projectId)));
    }

    @PostMapping("/{projectId}/members/invite")
    @AuditLog(action = "INVITE_MEMBER", resource = "project")
    public ResponseEntity<ApiResponse<TeamMemberResponse>> inviteMember(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID projectId,
            @Valid @RequestBody InviteMemberRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(projectService.inviteMember(userId, projectId, request)));
    }

    @DeleteMapping("/{projectId}/members/{targetUserId}")
    @AuditLog(action = "REMOVE_MEMBER", resource = "project")
    public ResponseEntity<Void> removeMember(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID projectId,
            @PathVariable UUID targetUserId) {
        projectService.removeMember(userId, projectId, targetUserId);
        return ResponseEntity.noContent().build();
    }
}
