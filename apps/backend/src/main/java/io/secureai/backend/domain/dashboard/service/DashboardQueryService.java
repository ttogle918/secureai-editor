package io.secureai.backend.domain.dashboard.service;

import io.secureai.backend.domain.dashboard.dto.DashboardResponse;
import io.secureai.backend.domain.project.service.ProjectService;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * 대시보드 조회 진입점 서비스.
 * 접근 권한 검증 책임만 담당하고,
 * 집계 및 캐싱은 {@link DashboardCacheService}에 위임한다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DashboardQueryService {

    private final ProjectService projectService;
    private final DashboardCacheService dashboardCacheService;

    /**
     * 프로젝트 대시보드 데이터를 반환한다.
     * 권한 검증 후 캐시된 집계 결과를 반환한다.
     *
     * @param userId    요청자 ID (접근 권한 확인용)
     * @param projectId 대상 프로젝트 ID
     * @return 대시보드 집계 응답
     * @throws BusinessException PROJECT_NOT_FOUND — 프로젝트가 없거나 삭제된 경우
     * @throws BusinessException PROJECT_ACCESS_DENIED — 멤버가 아닌 경우
     */
    public DashboardResponse getDashboard(UUID userId, UUID projectId) {
        validateAccess(userId, projectId);
        return dashboardCacheService.getAggregated(projectId);
    }

    private void validateAccess(UUID userId, UUID projectId) {
        projectService.findOrThrow(projectId);

        if (!projectService.isMember(projectId, userId)) {
            throw new BusinessException(ErrorCode.PROJECT_ACCESS_DENIED);
        }
    }
}
