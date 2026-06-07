package io.secureai.backend.domain.project.controller;

import io.secureai.backend.domain.project.dto.*;
import io.secureai.backend.domain.project.service.ProjectService;
import io.secureai.backend.global.response.ApiResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * ProjectController 단위 테스트 — 프로젝트 CRUD 및 멤버 관리의 위임/상태코드를
 * 검증한다. userId 는 @AuthenticationPrincipal, projectId 는 경로에서 받으며
 * 두 값이 서비스로 정확히 전달되는지 확인한다.
 */
@ExtendWith(MockitoExtension.class)
class ProjectControllerTest {

    @Mock ProjectService projectService;

    private ProjectController controller;
    private final UUID userId = UUID.randomUUID();
    private final UUID projectId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        controller = new ProjectController(projectService);
    }

    @Test
    @DisplayName("listProjects — 인증 주체와 페이지 요청을 위임하고 200 을 반환한다")
    void listProjects_delegates() {
        Pageable pageable = PageRequest.of(0, 20);
        @SuppressWarnings("unchecked")
        Page<ProjectListItemResponse> page = mock(Page.class);
        when(projectService.listProjects(userId, pageable)).thenReturn(page);

        ResponseEntity<ApiResponse<Page<ProjectListItemResponse>>> response =
                controller.listProjects(userId, pageable);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().getData()).isSameAs(page);
    }

    @Test
    @DisplayName("createProject — 생성 결과를 201 CREATED 로 반환한다")
    void createProject_returns201() {
        CreateProjectRequest req = mock(CreateProjectRequest.class);
        ProjectResponse created = mock(ProjectResponse.class);
        when(projectService.createProject(userId, req)).thenReturn(created);

        ResponseEntity<ApiResponse<ProjectResponse>> response = controller.createProject(userId, req);

        assertThat(response.getStatusCode().value()).isEqualTo(201);
        assertThat(response.getBody().getData()).isSameAs(created);
    }

    @Test
    @DisplayName("getProject — userId + projectId 로 조회하고 200 을 반환한다")
    void getProject_delegates() {
        ProjectResponse expected = mock(ProjectResponse.class);
        when(projectService.getProject(userId, projectId)).thenReturn(expected);

        ResponseEntity<ApiResponse<ProjectResponse>> response = controller.getProject(userId, projectId);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().getData()).isSameAs(expected);
        verify(projectService).getProject(userId, projectId);
    }

    @Test
    @DisplayName("updateProject — userId/projectId/요청을 위임하고 200 을 반환한다")
    void updateProject_delegates() {
        UpdateProjectRequest req = mock(UpdateProjectRequest.class);
        ProjectResponse updated = mock(ProjectResponse.class);
        when(projectService.updateProject(userId, projectId, req)).thenReturn(updated);

        ResponseEntity<ApiResponse<ProjectResponse>> response =
                controller.updateProject(userId, projectId, req);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().getData()).isSameAs(updated);
    }

    @Test
    @DisplayName("deleteProject — 삭제를 위임하고 204 를 반환한다")
    void deleteProject_returns204() {
        ResponseEntity<Void> response = controller.deleteProject(userId, projectId);

        assertThat(response.getStatusCode().value()).isEqualTo(204);
        verify(projectService).deleteProject(userId, projectId);
    }

    @Test
    @DisplayName("listMembers — 멤버 목록을 200 으로 반환한다")
    void listMembers_delegates() {
        List<TeamMemberResponse> members = List.of(mock(TeamMemberResponse.class));
        when(projectService.listMembers(userId, projectId)).thenReturn(members);

        ResponseEntity<ApiResponse<List<TeamMemberResponse>>> response =
                controller.listMembers(userId, projectId);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().getData()).hasSize(1);
    }

    @Test
    @DisplayName("inviteMember — 초대 결과를 201 CREATED 로 반환한다")
    void inviteMember_returns201() {
        InviteMemberRequest req = mock(InviteMemberRequest.class);
        TeamMemberResponse invited = mock(TeamMemberResponse.class);
        when(projectService.inviteMember(userId, projectId, req)).thenReturn(invited);

        ResponseEntity<ApiResponse<TeamMemberResponse>> response =
                controller.inviteMember(userId, projectId, req);

        assertThat(response.getStatusCode().value()).isEqualTo(201);
        assertThat(response.getBody().getData()).isSameAs(invited);
    }

    @Test
    @DisplayName("removeMember — 대상 멤버 제거를 위임하고 204 를 반환한다")
    void removeMember_returns204() {
        UUID targetUserId = UUID.randomUUID();

        ResponseEntity<Void> response = controller.removeMember(userId, projectId, targetUserId);

        assertThat(response.getStatusCode().value()).isEqualTo(204);
        verify(projectService).removeMember(userId, projectId, targetUserId);
    }
}
