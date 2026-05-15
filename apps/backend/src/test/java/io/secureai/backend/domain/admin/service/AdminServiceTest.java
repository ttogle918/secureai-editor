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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AdminServiceTest {

    @Mock UserRepository userRepository;
    @Mock PlanRepository planRepository;
    @Mock CreditTransactionRepository creditTransactionRepository;

    @InjectMocks AdminService adminService;

    private UUID adminId;
    private UUID targetUserId;
    private User targetUser;
    private Plan planFree;
    private Plan planPro;

    @BeforeEach
    void setUp() {
        adminId = UUID.randomUUID();
        targetUserId = UUID.randomUUID();

        planFree = new Plan();
        ReflectionTestUtils.setField(planFree, "id", (short) 1);
        ReflectionTestUtils.setField(planFree, "name", "free");
        ReflectionTestUtils.setField(planFree, "displayName", "Free");

        planPro = new Plan();
        ReflectionTestUtils.setField(planPro, "id", (short) 2);
        ReflectionTestUtils.setField(planPro, "name", "pro");
        ReflectionTestUtils.setField(planPro, "displayName", "Pro");

        targetUser = User.builder()
                .email("target@example.com")
                .username("target")
                .plan(planFree)
                .creditBalance(200)
                .isActive(true)
                .isAdmin(false)
                .build();
        ReflectionTestUtils.setField(targetUser, "id", targetUserId);
    }

    // =========================================================
    // listUsers
    // =========================================================

    @Test
    @DisplayName("listUsers: 검색 조건 없이 전체 사용자 목록을 반환한다")
    void listUsers_noFilter_returnsAllUsers() {
        // given
        Page<User> userPage = new PageImpl<>(List.of(targetUser));
        PageRequest pageable = PageRequest.of(0, 20);
        when(userRepository.searchUsers(null, null, null, pageable)).thenReturn(userPage);

        // when
        Page<AdminUserResponse> result = adminService.listUsers(null, null, null, pageable);

        // then
        assertThat(result.getContent()).hasSize(1);
        assertThat(result.getContent().get(0).email()).isEqualTo("target@example.com");
        verify(userRepository).searchUsers(null, null, null, pageable);
    }

    @Test
    @DisplayName("listUsers: planId 필터를 적용하면 searchUsers에 해당 값을 전달한다")
    void listUsers_withPlanIdFilter_passesPlanIdToRepository() {
        // given
        Page<User> userPage = new PageImpl<>(List.of(targetUser));
        PageRequest pageable = PageRequest.of(0, 20);
        when(userRepository.searchUsers(null, (short) 1, null, pageable)).thenReturn(userPage);

        // when
        adminService.listUsers(null, (short) 1, null, pageable);

        // then
        verify(userRepository).searchUsers(null, (short) 1, null, pageable);
    }

    // =========================================================
    // getUser
    // =========================================================

    @Test
    @DisplayName("getUser: 존재하는 userId를 조회하면 AdminUserResponse를 반환한다")
    void getUser_existingUser_returnsResponse() {
        // given
        when(userRepository.findByIdWithPlan(targetUserId)).thenReturn(Optional.of(targetUser));

        // when
        AdminUserResponse response = adminService.getUser(targetUserId);

        // then
        assertThat(response.id()).isEqualTo(targetUserId);
        assertThat(response.email()).isEqualTo("target@example.com");
        assertThat(response.planId()).isEqualTo((short) 1);
        assertThat(response.isAdmin()).isFalse();
    }

    @Test
    @DisplayName("getUser: 존재하지 않는 userId면 USER_NOT_FOUND 예외를 던진다")
    void getUser_nonExistentUser_throwsUserNotFound() {
        // given
        when(userRepository.findByIdWithPlan(any())).thenReturn(Optional.empty());

        // when / then
        assertThatThrownBy(() -> adminService.getUser(UUID.randomUUID()))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.USER_NOT_FOUND);
    }

    // =========================================================
    // changeUserPlan
    // =========================================================

    @Test
    @DisplayName("changeUserPlan: 정상 요청 시 User.plan이 새 플랜으로 변경된다")
    void changeUserPlan_validRequest_updatesUserPlan() {
        // given
        when(userRepository.findByIdWithPlan(targetUserId)).thenReturn(Optional.of(targetUser));
        when(planRepository.findById((short) 2)).thenReturn(Optional.of(planPro));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        // when
        adminService.changeUserPlan(targetUserId, (short) 2, "upgrade test", adminId);

        // then
        assertThat(targetUser.getPlan().getName()).isEqualTo("pro");
        verify(userRepository).save(targetUser);
    }

    @Test
    @DisplayName("changeUserPlan: 어드민이 자기 자신의 플랜을 변경하면 ADMIN_SELF_MODIFICATION_DENIED 예외를 던진다")
    void changeUserPlan_selfModification_throwsForbidden() {
        // when / then
        assertThatThrownBy(() -> adminService.changeUserPlan(adminId, (short) 2, "self change", adminId))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.ADMIN_SELF_MODIFICATION_DENIED);

        verifyNoInteractions(planRepository);
        verifyNoInteractions(userRepository);
    }

    @Test
    @DisplayName("changeUserPlan: 존재하지 않는 planId면 ADMIN_PLAN_NOT_FOUND 예외를 던진다")
    void changeUserPlan_nonExistentPlan_throwsPlanNotFound() {
        // given
        when(userRepository.findByIdWithPlan(targetUserId)).thenReturn(Optional.of(targetUser));
        when(planRepository.findById(any())).thenReturn(Optional.empty());

        // when / then
        assertThatThrownBy(() -> adminService.changeUserPlan(targetUserId, (short) 99, "invalid plan", adminId))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.ADMIN_PLAN_NOT_FOUND);
    }

    // =========================================================
    // toggleUserActive
    // =========================================================

    @Test
    @DisplayName("toggleUserActive: isActive=false 요청 시 사용자가 비활성화된다")
    void toggleUserActive_deactivate_setsIsActiveFalse() {
        // given
        when(userRepository.findByIdWithPlan(targetUserId)).thenReturn(Optional.of(targetUser));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        // when
        adminService.toggleUserActive(targetUserId, false, adminId);

        // then
        assertThat(targetUser.getIsActive()).isFalse();
        verify(userRepository).save(targetUser);
    }

    @Test
    @DisplayName("toggleUserActive: 어드민이 자기 자신을 비활성화하면 ADMIN_SELF_MODIFICATION_DENIED 예외를 던진다")
    void toggleUserActive_selfDeactivation_throwsForbidden() {
        // when / then
        assertThatThrownBy(() -> adminService.toggleUserActive(adminId, false, adminId))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.ADMIN_SELF_MODIFICATION_DENIED);

        verifyNoInteractions(userRepository);
    }

    // =========================================================
    // adjustCredits
    // =========================================================

    @Test
    @DisplayName("adjustCredits: 양수 delta 지급 시 크레딧 잔액이 증가하고 거래 내역이 기록된다")
    void adjustCredits_positiveDelta_increasesBalance() {
        // given
        int initialBalance = targetUser.getCreditBalance(); // 200
        int delta = 500;
        when(userRepository.findByIdWithPlan(targetUserId)).thenReturn(Optional.of(targetUser));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(creditTransactionRepository.save(any(CreditTransaction.class))).thenAnswer(inv -> inv.getArgument(0));

        // when
        int balanceAfter = adminService.adjustCredits(targetUserId, delta, "test grant", adminId);

        // then
        assertThat(balanceAfter).isEqualTo(initialBalance + delta);
        assertThat(targetUser.getCreditBalance()).isEqualTo(initialBalance + delta);

        ArgumentCaptor<CreditTransaction> txCaptor = ArgumentCaptor.forClass(CreditTransaction.class);
        verify(creditTransactionRepository).save(txCaptor.capture());
        CreditTransaction savedTx = txCaptor.getValue();
        assertThat(savedTx.getDelta()).isEqualTo(delta);
        assertThat(savedTx.getBalanceAfter()).isEqualTo(initialBalance + delta);
        assertThat(savedTx.getReason()).contains("test grant");
    }

    @Test
    @DisplayName("adjustCredits: 음수 delta 차감 시 잔액이 0 미만으로 내려가지 않는다")
    void adjustCredits_negativeDeltaExceedsBalance_clampsToZero() {
        // given: 잔액 200, 차감 -10000
        when(userRepository.findByIdWithPlan(targetUserId)).thenReturn(Optional.of(targetUser));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(creditTransactionRepository.save(any(CreditTransaction.class))).thenAnswer(inv -> inv.getArgument(0));

        // when
        int balanceAfter = adminService.adjustCredits(targetUserId, -10000, "penalty", adminId);

        // then: 음수 방지, 0으로 고정
        assertThat(balanceAfter).isEqualTo(0);
        assertThat(targetUser.getCreditBalance()).isEqualTo(0);
    }

    @Test
    @DisplayName("adjustCredits: 존재하지 않는 사용자면 USER_NOT_FOUND 예외를 던진다")
    void adjustCredits_nonExistentUser_throwsUserNotFound() {
        // given
        when(userRepository.findByIdWithPlan(any())).thenReturn(Optional.empty());

        // when / then
        assertThatThrownBy(() -> adminService.adjustCredits(UUID.randomUUID(), 100, "grant", adminId))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.USER_NOT_FOUND);

        verifyNoInteractions(creditTransactionRepository);
    }
}
