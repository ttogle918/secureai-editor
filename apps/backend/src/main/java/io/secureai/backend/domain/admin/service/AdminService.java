package io.secureai.backend.domain.admin.service;

import io.secureai.backend.domain.admin.dto.AdminUserResponse;
import io.secureai.backend.domain.credit.entity.CreditTransaction;
import io.secureai.backend.domain.credit.repository.CreditTransactionRepository;
import io.secureai.backend.domain.plan.Plan;
import io.secureai.backend.domain.plan.PlanRepository;
import io.secureai.backend.domain.user.entity.User;
import io.secureai.backend.domain.user.repository.UserRepository;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AdminService {

    private final UserRepository userRepository;
    private final PlanRepository planRepository;
    private final CreditTransactionRepository creditTransactionRepository;

    /** 사용자 목록 조회 (페이징 + 검색 + 필터) */
    @Transactional(readOnly = true)
    public Page<AdminUserResponse> listUsers(String search, Short planId, Boolean isActive, Pageable pageable) {
        return userRepository.searchUsers(search, planId, isActive, pageable)
                .map(AdminUserResponse::from);
    }

    /** 개별 사용자 조회 */
    @Transactional(readOnly = true)
    public AdminUserResponse getUser(UUID userId) {
        User user = findUserWithPlan(userId);
        return AdminUserResponse.from(user);
    }

    /** 플랜 변경 — 어드민이 자기 자신의 플랜을 변경하는 것은 허용하지 않는다 */
    @Transactional
    public void changeUserPlan(UUID targetUserId, Short newPlanId, String reason, UUID adminId) {
        guardSelfModification(targetUserId, adminId, "plan change");

        User user = findUserWithPlan(targetUserId);
        Plan newPlan = planRepository.findById(newPlanId)
                .orElseThrow(() -> new BusinessException(ErrorCode.ADMIN_PLAN_NOT_FOUND,
                        "planId=" + newPlanId));

        Plan oldPlan = user.getPlan();
        user.setPlan(newPlan);
        userRepository.save(user);

        log.info("[admin] plan changed userId={} oldPlan={} newPlan={} reason={} adminId={}",
                targetUserId, oldPlan.getName(), newPlan.getName(), reason, adminId);
    }

    /** 계정 활성화/비활성화 — 어드민이 자기 자신의 상태를 변경하는 것은 허용하지 않는다 */
    @Transactional
    public void toggleUserActive(UUID targetUserId, boolean isActive, UUID adminId) {
        guardSelfModification(targetUserId, adminId, "status toggle");

        User user = findUserWithPlan(targetUserId);
        user.setIsActive(isActive);
        userRepository.save(user);

        log.info("[admin] user status changed userId={} isActive={} adminId={}",
                targetUserId, isActive, adminId);
    }

    /** 크레딧 수동 지급/차감 */
    @Transactional
    public int adjustCredits(UUID targetUserId, int delta, String reason, UUID adminId) {
        User user = findUserWithPlan(targetUserId);

        int newBalance = user.getCreditBalance() + delta;
        if (newBalance < 0) {
            newBalance = 0;
        }
        user.setCreditBalance(newBalance);
        userRepository.save(user);

        creditTransactionRepository.save(CreditTransaction.builder()
                .user(user)
                .delta(delta)
                .reason("admin_manual:" + reason)
                .balanceAfter(newBalance)
                .build());

        log.info("[admin] credit adjusted userId={} delta={} balanceAfter={} adminId={}",
                targetUserId, delta, newBalance, adminId);
        return newBalance;
    }

    // --- private helpers ---

    private User findUserWithPlan(UUID userId) {
        return userRepository.findByIdWithPlan(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND,
                        "userId=" + userId));
    }

    /**
     * 어드민이 자기 자신을 대상으로 하는 위험한 변경을 방어한다.
     * 자기 자신의 플랜 변경 또는 비활성화는 실수로 인한 잠금 위험이 있다.
     */
    private void guardSelfModification(UUID targetUserId, UUID adminId, String operation) {
        if (targetUserId.equals(adminId)) {
            log.warn("[admin] self-modification attempt blocked adminId={} operation={}", adminId, operation);
            throw new BusinessException(ErrorCode.ADMIN_SELF_MODIFICATION_DENIED);
        }
    }
}
