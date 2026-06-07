package io.secureai.backend.domain.scheduling.service;

import io.secureai.backend.domain.project.repository.TeamMemberRepository;
import io.secureai.backend.domain.scheduling.dto.ProjectScheduleRequest;
import io.secureai.backend.domain.scheduling.dto.ProjectScheduleResponse;
import io.secureai.backend.domain.scheduling.entity.ProjectSchedule;
import io.secureai.backend.domain.scheduling.repository.ProjectScheduleRepository;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProjectScheduleServiceTest {

    @Mock
    private ProjectScheduleRepository projectScheduleRepository;

    @Mock
    private TeamMemberRepository teamMemberRepository;

    @InjectMocks
    private ProjectScheduleService service;

    private final UUID userId = UUID.randomUUID();
    private final UUID projectId = UUID.randomUUID();

    // ---------- getSchedule ----------

    @Test
    @DisplayName("getSchedule — 팀 멤버가 아니면 PROJECT_ACCESS_DENIED, 조회를 시도하지 않는다")
    void getSchedule_notMember_throwsAccessDenied() {
        when(teamMemberRepository.existsByProjectIdAndUserId(projectId, userId)).thenReturn(false);

        assertThatThrownBy(() -> service.getSchedule(userId, projectId))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getErrorCode())
                        .isEqualTo(ErrorCode.PROJECT_ACCESS_DENIED));

        verify(projectScheduleRepository, never()).findByProjectId(any());
    }

    @Test
    @DisplayName("getSchedule — 멤버이지만 스케줄이 없으면 PROJECT_NOT_FOUND")
    void getSchedule_noSchedule_throwsNotFound() {
        when(teamMemberRepository.existsByProjectIdAndUserId(projectId, userId)).thenReturn(true);
        when(projectScheduleRepository.findByProjectId(projectId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getSchedule(userId, projectId))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getErrorCode())
                        .isEqualTo(ErrorCode.PROJECT_NOT_FOUND));
    }

    @Test
    @DisplayName("getSchedule — 멤버이고 스케줄이 있으면 응답으로 변환해 반환한다")
    void getSchedule_success_returnsResponse() {
        UUID scheduleId = UUID.randomUUID();
        ProjectSchedule schedule = ProjectSchedule.builder()
                .id(scheduleId)
                .projectId(projectId)
                .isActive(true)
                .scanHour(5)
                .build();
        when(teamMemberRepository.existsByProjectIdAndUserId(projectId, userId)).thenReturn(true);
        when(projectScheduleRepository.findByProjectId(projectId)).thenReturn(Optional.of(schedule));

        ProjectScheduleResponse response = service.getSchedule(userId, projectId);

        assertThat(response.id()).isEqualTo(scheduleId);
        assertThat(response.projectId()).isEqualTo(projectId);
        assertThat(response.isActive()).isTrue();
        assertThat(response.scanHour()).isEqualTo(5);
    }

    // ---------- upsertSchedule ----------

    @Test
    @DisplayName("upsertSchedule — 팀 멤버가 아니면 PROJECT_ACCESS_DENIED, 저장하지 않는다")
    void upsertSchedule_notMember_throwsAccessDenied() {
        when(teamMemberRepository.existsByProjectIdAndUserId(projectId, userId)).thenReturn(false);

        assertThatThrownBy(() -> service.upsertSchedule(userId, projectId,
                new ProjectScheduleRequest(true, 3)))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getErrorCode())
                        .isEqualTo(ErrorCode.PROJECT_ACCESS_DENIED));

        verify(projectScheduleRepository, never()).save(any());
    }

    @Test
    @DisplayName("upsertSchedule — 기존 스케줄이 없으면 신규 생성하며 요청 값을 반영한다")
    void upsertSchedule_noExisting_createsWithRequestValues() {
        when(teamMemberRepository.existsByProjectIdAndUserId(projectId, userId)).thenReturn(true);
        when(projectScheduleRepository.findByProjectId(projectId)).thenReturn(Optional.empty());
        when(projectScheduleRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.upsertSchedule(userId, projectId, new ProjectScheduleRequest(false, 9));

        ArgumentCaptor<ProjectSchedule> captor = ArgumentCaptor.forClass(ProjectSchedule.class);
        verify(projectScheduleRepository).save(captor.capture());
        ProjectSchedule saved = captor.getValue();
        assertThat(saved.getProjectId()).isEqualTo(projectId);
        assertThat(saved.isActive()).isFalse();
        assertThat(saved.getScanHour()).isEqualTo(9);
    }

    @Test
    @DisplayName("upsertSchedule — 기존 스케줄이 있으면 제공된 필드만 갱신한다")
    void upsertSchedule_existing_updatesProvidedFields() {
        ProjectSchedule existing = ProjectSchedule.builder()
                .projectId(projectId)
                .isActive(true)
                .scanHour(1)
                .build();
        when(teamMemberRepository.existsByProjectIdAndUserId(projectId, userId)).thenReturn(true);
        when(projectScheduleRepository.findByProjectId(projectId)).thenReturn(Optional.of(existing));
        when(projectScheduleRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.upsertSchedule(userId, projectId, new ProjectScheduleRequest(false, 22));

        verify(projectScheduleRepository).save(existing);
        assertThat(existing.isActive()).isFalse();
        assertThat(existing.getScanHour()).isEqualTo(22);
    }

    @Test
    @DisplayName("upsertSchedule — 요청 필드가 null이면 기존 값을 보존한다 (부분 수정)")
    void upsertSchedule_nullFields_keepExistingValues() {
        ProjectSchedule existing = ProjectSchedule.builder()
                .projectId(projectId)
                .isActive(true)
                .scanHour(7)
                .build();
        when(teamMemberRepository.existsByProjectIdAndUserId(projectId, userId)).thenReturn(true);
        when(projectScheduleRepository.findByProjectId(projectId)).thenReturn(Optional.of(existing));
        when(projectScheduleRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.upsertSchedule(userId, projectId, new ProjectScheduleRequest(null, null));

        verify(projectScheduleRepository).save(existing);
        assertThat(existing.isActive()).isTrue();
        assertThat(existing.getScanHour()).isEqualTo(7);
    }
}
