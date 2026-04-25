package io.secureai.backend.domain.project.service;

import io.secureai.backend.domain.plan.Plan;
import io.secureai.backend.domain.project.entity.Project;
import io.secureai.backend.domain.project.entity.TeamMember;
import io.secureai.backend.domain.project.repository.ProjectRepository;
import io.secureai.backend.domain.project.repository.TeamMemberRepository;
import io.secureai.backend.domain.user.entity.User;
import io.secureai.backend.domain.user.repository.UserRepository;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import io.secureai.backend.global.plan.PlanChecker;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ProjectServiceTest {

    @Mock ProjectRepository projectRepository;
    @Mock TeamMemberRepository teamMemberRepository;
    @Mock UserRepository userRepository;
    @Mock ApplicationEventPublisher eventPublisher;
    @Mock PlanChecker planChecker;

    @InjectMocks ProjectService projectService;

    private UUID ownerId;
    private UUID memberId;
    private UUID projectId;
    private Project project;

    @BeforeEach
    void setUp() {
        ownerId = UUID.randomUUID();
        memberId = UUID.randomUUID();
        projectId = UUID.randomUUID();

        User owner = User.builder()
                .email("owner@example.com")
                .username("owner")
                .emailVerified(true)
                .plan(new Plan())
                .build();
        ReflectionTestUtils.setField(owner, "id", ownerId);

        project = Project.builder()
                .owner(owner)
                .name("Test Project")
                .sourceType("upload")
                .build();
        ReflectionTestUtils.setField(project, "id", projectId);
    }

    @Test
    void deleteProject_byOwner_softDeletes() {
        TeamMember ownerMember = TeamMember.builder().role("owner").build();
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(teamMemberRepository.findByProjectIdAndUserId(projectId, ownerId))
                .thenReturn(Optional.of(ownerMember));

        projectService.deleteProject(ownerId, projectId);

        assertThat(project.getDeletedAt()).isNotNull();
        verify(projectRepository).save(project);
        verify(eventPublisher).publishEvent(any());
    }

    @Test
    void deleteProject_byNonOwner_throws403() {
        TeamMember viewerMember = TeamMember.builder().role("viewer").build();
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(teamMemberRepository.findByProjectIdAndUserId(projectId, memberId))
                .thenReturn(Optional.of(viewerMember));

        assertThatThrownBy(() -> projectService.deleteProject(memberId, projectId))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getErrorCode())
                        .isEqualTo(ErrorCode.PROJECT_ACCESS_DENIED));
    }

    @Test
    void deleteProject_byNonMember_throws403() {
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(teamMemberRepository.findByProjectIdAndUserId(projectId, memberId))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> projectService.deleteProject(memberId, projectId))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getErrorCode())
                        .isEqualTo(ErrorCode.PROJECT_ACCESS_DENIED));
    }

    @Test
    void inviteMember_planLimitExceeded_throws() {
        TeamMember adminMember = TeamMember.builder().role("owner").build();
        when(teamMemberRepository.findByProjectIdAndUserId(projectId, ownerId))
                .thenReturn(Optional.of(adminMember));
        doThrow(new BusinessException(ErrorCode.PROJECT_MEMBER_LIMIT_EXCEEDED))
                .when(planChecker).canAddMember(projectId);

        var request = new io.secureai.backend.domain.project.dto.InviteMemberRequest();
        ReflectionTestUtils.setField(request, "email", "new@example.com");
        ReflectionTestUtils.setField(request, "role", "viewer");

        assertThatThrownBy(() -> projectService.inviteMember(ownerId, projectId, request))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getErrorCode())
                        .isEqualTo(ErrorCode.PROJECT_MEMBER_LIMIT_EXCEEDED));
    }

    @Test
    void removeMember_owner_throws() {
        TeamMember adminMember = TeamMember.builder().role("owner").build();
        TeamMember targetOwnerMember = TeamMember.builder().role("owner").build();

        when(teamMemberRepository.findByProjectIdAndUserId(projectId, ownerId))
                .thenReturn(Optional.of(adminMember));
        when(teamMemberRepository.findByProjectIdAndUserId(projectId, memberId))
                .thenReturn(Optional.of(targetOwnerMember));

        assertThatThrownBy(() -> projectService.removeMember(ownerId, projectId, memberId))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getErrorCode())
                        .isEqualTo(ErrorCode.PROJECT_ACCESS_DENIED));
    }
}
