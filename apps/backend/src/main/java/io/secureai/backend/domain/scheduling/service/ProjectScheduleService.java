package io.secureai.backend.domain.scheduling.service;

import io.secureai.backend.domain.project.repository.TeamMemberRepository;
import io.secureai.backend.domain.scheduling.dto.ProjectScheduleRequest;
import io.secureai.backend.domain.scheduling.dto.ProjectScheduleResponse;
import io.secureai.backend.domain.scheduling.entity.ProjectSchedule;
import io.secureai.backend.domain.scheduling.repository.ProjectScheduleRepository;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * 프로젝트 스케줄 CRUD 서비스.
 *
 * <p>SRP: 스케줄 설정 저장/조회만 담당한다. 실제 스캔 실행은 {@link NightlyScanService}가 담당한다.
 *
 * <p>도메인 격리 주의: 팀 멤버 여부 확인을 위해 {@link TeamMemberRepository}를 직접 주입한다.
 * MVP 범위에서 허용하며, 향후 ProjectService 파사드를 통해 간접 참조하는 방향으로 전환 예정이다.
 */
@Service
@RequiredArgsConstructor
public class ProjectScheduleService {

    private final ProjectScheduleRepository projectScheduleRepository;

    // TODO(향후): ProjectService 파사드를 통해 간접 참조하도록 리팩토링 예정
    private final TeamMemberRepository teamMemberRepository;

    /**
     * 프로젝트 스케줄을 조회한다.
     *
     * @throws BusinessException PROJECT_NOT_FOUND 스케줄이 없는 경우
     * @throws BusinessException PROJECT_ACCESS_DENIED 팀 멤버가 아닌 경우
     */
    @Transactional(readOnly = true)
    public ProjectScheduleResponse getSchedule(UUID userId, UUID projectId) {
        checkMemberAccess(userId, projectId);
        ProjectSchedule schedule = projectScheduleRepository.findByProjectId(projectId)
                .orElseThrow(() -> new BusinessException(ErrorCode.PROJECT_NOT_FOUND,
                        "스케줄이 존재하지 않습니다. PUT으로 먼저 생성하세요."));
        return ProjectScheduleResponse.from(schedule);
    }

    /**
     * 프로젝트 스케줄을 생성하거나 수정한다 (Upsert).
     *
     * @throws BusinessException PROJECT_ACCESS_DENIED 팀 멤버가 아닌 경우
     */
    @Transactional
    public ProjectScheduleResponse upsertSchedule(UUID userId, UUID projectId,
                                                   ProjectScheduleRequest request) {
        checkMemberAccess(userId, projectId);

        ProjectSchedule schedule = projectScheduleRepository.findByProjectId(projectId)
                .orElseGet(() -> ProjectSchedule.builder().projectId(projectId).build());

        if (request.isActive() != null) {
            schedule.setActive(request.isActive());
        }
        if (request.scanHour() != null) {
            schedule.setScanHour(request.scanHour());
        }

        ProjectSchedule saved = projectScheduleRepository.save(schedule);
        return ProjectScheduleResponse.from(saved);
    }

    private void checkMemberAccess(UUID userId, UUID projectId) {
        if (!teamMemberRepository.existsByProjectIdAndUserId(projectId, userId)) {
            throw new BusinessException(ErrorCode.PROJECT_ACCESS_DENIED);
        }
    }
}
