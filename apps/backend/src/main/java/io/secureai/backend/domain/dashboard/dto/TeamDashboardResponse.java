package io.secureai.backend.domain.dashboard.dto;

import java.util.List;
import java.util.UUID;

/**
 * 팀(조직) 대시보드 집계 응답 DTO.
 * 팀 전체 보안 지표와 멤버별 gamification 통계를 단일 응답으로 반환한다.
 */
public record TeamDashboardResponse(
        UUID teamId,
        String teamName,
        List<MemberStat> members,
        long totalCritical,
        long totalHigh,
        double avgMttrHours,
        long monthlyTokenUsage
) {

    /**
     * 팀 멤버별 보안 점수 및 세션 통계.
     * 보안 점수 기준 내림차순으로 rank가 부여된다.
     */
    public record MemberStat(
            UUID userId,
            String username,
            int securityScore,
            long totalSessions,
            int rank
    ) {}
}
