package io.secureai.backend.global.plan;

import io.secureai.backend.domain.plan.Plan;
import io.secureai.backend.domain.project.repository.TeamMemberRepository;
import io.secureai.backend.domain.user.entity.User;
import io.secureai.backend.domain.user.repository.UserRepository;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component("planChecker")
@RequiredArgsConstructor
public class PlanChecker {

    private final UserRepository userRepository;
    private final TeamMemberRepository teamMemberRepository;

    public boolean canStartAnalysis(UUID userId, String layerType) {
        User user = loadUser(userId);
        Plan plan = user.getPlan();

        if ("dast".equals(layerType) || "full".equals(layerType)) {
            if (!plan.getAllowDast()) {
                throw new BusinessException(ErrorCode.PLAN_FEATURE_NOT_ALLOWED,
                        "DAST는 Pro 플랜 이상에서 사용 가능합니다.");
            }
        }

        int limit = plan.getMonthlySastLimit();
        if (limit != -1 && user.getSastUsageThisMonth() >= limit) {
            throw new BusinessException(ErrorCode.PLAN_LIMIT_EXCEEDED,
                    "이번 달 SAST 사용량(%d/%d)을 초과했습니다.".formatted(user.getSastUsageThisMonth(), limit));
        }
        return true;
    }

    public boolean canCreateProject(UUID userId) {
        return true;
    }

    public boolean canAddMember(UUID projectId) {
        int maxMembers = teamMemberRepository.findOwnerByProjectId(projectId)
                .map(owner -> (int) owner.getUser().getPlan().getMaxMembers())
                .orElse(1);
        if (maxMembers == -1) return true;

        int current = teamMemberRepository.countByProjectId(projectId);
        if (current >= maxMembers) {
            throw new BusinessException(ErrorCode.PROJECT_MEMBER_LIMIT_EXCEEDED,
                    "플랜의 최대 멤버 수(%d명)를 초과합니다.".formatted(maxMembers));
        }
        return true;
    }

    public boolean allowsDast(UUID userId) {
        User user = loadUser(userId);
        if (!user.getPlan().getAllowDast()) {
            throw new BusinessException(ErrorCode.PLAN_FEATURE_NOT_ALLOWED, "DAST는 Pro 플랜 이상에서 사용 가능합니다.");
        }
        return true;
    }

    public boolean allowsMonitoring(UUID userId) {
        User user = loadUser(userId);
        if (!user.getPlan().getAllowMonitoring()) {
            throw new BusinessException(ErrorCode.PLAN_FEATURE_NOT_ALLOWED, "모니터링은 Team 플랜 이상에서 사용 가능합니다.");
        }
        return true;
    }

    public boolean allowsPdfReport(UUID userId) {
        User user = loadUser(userId);
        if (!user.getPlan().getAllowPdfReport()) {
            throw new BusinessException(ErrorCode.PLAN_FEATURE_NOT_ALLOWED, "PDF 리포트는 Pro 플랜 이상에서 사용 가능합니다.");
        }
        return true;
    }

    public boolean allowsSbom(UUID userId) {
        User user = loadUser(userId);
        if (!user.getPlan().getAllowSbom()) {
            throw new BusinessException(ErrorCode.PLAN_FEATURE_NOT_ALLOWED, "SBOM은 Pro 플랜 이상에서 사용 가능합니다.");
        }
        return true;
    }

    private User loadUser(UUID userId) {
        return userRepository.findByIdWithPlan(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
    }
}
