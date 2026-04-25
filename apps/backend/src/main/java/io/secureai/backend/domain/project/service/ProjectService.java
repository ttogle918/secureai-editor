package io.secureai.backend.domain.project.service;

import io.secureai.backend.domain.project.dto.*;
import io.secureai.backend.domain.project.entity.Project;
import io.secureai.backend.domain.project.entity.TeamMember;
import io.secureai.backend.domain.project.event.ProjectDeletedEvent;
import io.secureai.backend.domain.project.repository.ProjectRepository;
import io.secureai.backend.domain.project.repository.TeamMemberRepository;
import io.secureai.backend.domain.user.entity.User;
import io.secureai.backend.domain.user.repository.UserRepository;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import io.secureai.backend.global.plan.PlanChecker;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ProjectService {

    private final ProjectRepository projectRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final UserRepository userRepository;
    private final ApplicationEventPublisher eventPublisher;
    private final PlanChecker planChecker;

    @Transactional(readOnly = true)
    public Page<ProjectListItemResponse> listProjects(UUID userId, Pageable pageable) {
        return projectRepository.findAllAccessibleByUser(userId, pageable)
                .map(ProjectListItemResponse::from);
    }

    @Transactional
    public ProjectResponse createProject(UUID userId, CreateProjectRequest request) {
        User owner = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));

        if (projectRepository.existsByOwnerIdAndName(userId, request.getName())) {
            throw new BusinessException(ErrorCode.PROJECT_DUPLICATE_NAME);
        }

        Project project = Project.builder()
                .owner(owner)
                .name(request.getName())
                .description(request.getDescription())
                .sourceType(request.getSourceType())
                .githubRepoFullName(request.getGithubRepoFullName())
                .githubDefaultBranch(request.getGithubDefaultBranch())
                .build();
        projectRepository.save(project);

        // 생성자를 owner 멤버로 등록
        TeamMember ownerMember = TeamMember.builder()
                .project(project)
                .user(owner)
                .role("owner")
                .acceptedAt(OffsetDateTime.now())
                .build();
        teamMemberRepository.save(ownerMember);

        return ProjectResponse.from(project);
    }

    @Transactional(readOnly = true)
    @Cacheable(value = "projectDetail", key = "#projectId")
    public ProjectResponse getProject(UUID userId, UUID projectId) {
        Project project = loadProject(projectId);
        checkAccess(userId, projectId);
        return ProjectResponse.from(project);
    }

    @Transactional
    @CacheEvict(value = "projectDetail", key = "#projectId")
    public ProjectResponse updateProject(UUID userId, UUID projectId, UpdateProjectRequest request) {
        Project project = loadProject(projectId);
        checkAdminAccess(userId, projectId);

        if (request.getName() != null) project.setName(request.getName());
        if (request.getDescription() != null) project.setDescription(request.getDescription());
        projectRepository.save(project);
        return ProjectResponse.from(project);
    }

    @Transactional
    @CacheEvict(value = "projectDetail", key = "#projectId")
    public void deleteProject(UUID userId, UUID projectId) {
        Project project = loadProject(projectId);
        checkOwnerAccess(userId, projectId);
        project.softDelete();
        projectRepository.save(project);
        eventPublisher.publishEvent(new ProjectDeletedEvent(this, projectId, userId, OffsetDateTime.now()));
    }

    @Transactional(readOnly = true)
    public List<TeamMemberResponse> listMembers(UUID userId, UUID projectId) {
        checkAccess(userId, projectId);
        return teamMemberRepository.findByProjectId(projectId)
                .stream().map(TeamMemberResponse::from).toList();
    }

    @Transactional
    public TeamMemberResponse inviteMember(UUID userId, UUID projectId, InviteMemberRequest request) {
        checkAdminAccess(userId, projectId);
        planChecker.canAddMember(projectId);
        Project project = loadProject(projectId);

        User invitedUser = userRepository.findByEmailAndDeletedAtIsNull(request.getEmail())
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND,
                        "초대할 사용자를 찾을 수 없습니다: " + request.getEmail()));

        if (teamMemberRepository.existsByProjectIdAndUserId(projectId, invitedUser.getId())) {
            throw new BusinessException(ErrorCode.PROJECT_MEMBER_ALREADY_EXISTS);
        }

        User inviter = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));

        TeamMember member = TeamMember.builder()
                .project(project)
                .user(invitedUser)
                .role(request.getRole())
                .invitedBy(inviter)
                .build();
        teamMemberRepository.save(member);
        return TeamMemberResponse.from(member);
    }

    @Transactional
    public void removeMember(UUID requesterId, UUID projectId, UUID targetUserId) {
        checkAdminAccess(requesterId, projectId);
        TeamMember member = teamMemberRepository.findByProjectIdAndUserId(projectId, targetUserId)
                .orElseThrow(() -> new BusinessException(ErrorCode.PROJECT_MEMBER_NOT_FOUND));

        if (member.isOwner()) {
            throw new BusinessException(ErrorCode.PROJECT_ACCESS_DENIED, "프로젝트 소유자는 제거할 수 없습니다.");
        }
        teamMemberRepository.delete(member);
    }

    private Project loadProject(UUID projectId) {
        return projectRepository.findById(projectId)
                .orElseThrow(() -> new BusinessException(ErrorCode.PROJECT_NOT_FOUND));
    }

    private void checkAccess(UUID userId, UUID projectId) {
        if (!teamMemberRepository.existsByProjectIdAndUserId(projectId, userId)) {
            throw new BusinessException(ErrorCode.PROJECT_ACCESS_DENIED);
        }
    }

    private void checkAdminAccess(UUID userId, UUID projectId) {
        TeamMember member = teamMemberRepository.findByProjectIdAndUserId(projectId, userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.PROJECT_ACCESS_DENIED));
        if (!member.isAdmin()) {
            throw new BusinessException(ErrorCode.PROJECT_ACCESS_DENIED, "admin 이상의 권한이 필요합니다.");
        }
    }

    private void checkOwnerAccess(UUID userId, UUID projectId) {
        TeamMember member = teamMemberRepository.findByProjectIdAndUserId(projectId, userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.PROJECT_ACCESS_DENIED));
        if (!member.isOwner()) {
            throw new BusinessException(ErrorCode.PROJECT_ACCESS_DENIED, "owner 권한이 필요합니다.");
        }
    }
}
