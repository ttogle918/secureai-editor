package io.secureai.backend.global.plan;

import io.secureai.backend.domain.plan.Plan;
import io.secureai.backend.domain.project.entity.TeamMember;
import io.secureai.backend.domain.project.repository.TeamMemberRepository;
import io.secureai.backend.domain.user.entity.User;
import io.secureai.backend.domain.user.repository.UserRepository;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PlanCheckerTest {

    @Mock UserRepository userRepository;
    @Mock TeamMemberRepository teamMemberRepository;

    @InjectMocks PlanChecker planChecker;

    private UUID userId;
    private UUID projectId;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        projectId = UUID.randomUUID();
    }

    @Test
    void freePlan_canStartAnalysis_withinLimit() {
        User user = userWithPlan(false, 50, 10);
        when(userRepository.findByIdWithPlan(userId)).thenReturn(Optional.of(user));

        assertThatCode(() -> planChecker.canStartAnalysis(userId, "sast")).doesNotThrowAnyException();
    }

    @Test
    void freePlan_canStartAnalysis_limitReached_throws() {
        User user = userWithPlan(false, 50, 50); // 50/50 used
        when(userRepository.findByIdWithPlan(userId)).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> planChecker.canStartAnalysis(userId, "sast"))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getErrorCode())
                        .isEqualTo(ErrorCode.PLAN_LIMIT_EXCEEDED));
    }

    @Test
    void freePlan_dastNotAllowed_throws() {
        User user = userWithPlan(false, 50, 0); // allowDast = false
        when(userRepository.findByIdWithPlan(userId)).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> planChecker.canStartAnalysis(userId, "dast"))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getErrorCode())
                        .isEqualTo(ErrorCode.PLAN_FEATURE_NOT_ALLOWED));
    }

    @Test
    void proPlan_dastAllowed() {
        User user = userWithPlan(true, -1, 0); // allowDast = true, unlimited
        when(userRepository.findByIdWithPlan(userId)).thenReturn(Optional.of(user));

        assertThatCode(() -> planChecker.canStartAnalysis(userId, "dast")).doesNotThrowAnyException();
    }

    @Test
    void canAddMember_withinLimit_succeeds() {
        User owner = userWithPlan(false, 50, 0);
        ReflectionTestUtils.setField(owner.getPlan(), "maxMembers", (short) 5);
        TeamMember ownerMember = mock(TeamMember.class);
        when(ownerMember.getUser()).thenReturn(owner);

        when(teamMemberRepository.findOwnerByProjectId(projectId)).thenReturn(Optional.of(ownerMember));
        when(teamMemberRepository.countByProjectId(projectId)).thenReturn(3);

        assertThatCode(() -> planChecker.canAddMember(projectId)).doesNotThrowAnyException();
    }

    @Test
    void canAddMember_atLimit_throws() {
        User owner = userWithPlan(false, 50, 0);
        ReflectionTestUtils.setField(owner.getPlan(), "maxMembers", (short) 1);
        TeamMember ownerMember = mock(TeamMember.class);
        when(ownerMember.getUser()).thenReturn(owner);

        when(teamMemberRepository.findOwnerByProjectId(projectId)).thenReturn(Optional.of(ownerMember));
        when(teamMemberRepository.countByProjectId(projectId)).thenReturn(1);

        assertThatThrownBy(() -> planChecker.canAddMember(projectId))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getErrorCode())
                        .isEqualTo(ErrorCode.PROJECT_MEMBER_LIMIT_EXCEEDED));
    }

    @Test
    void canAddMember_unlimitedPlan_succeeds() {
        User owner = userWithPlan(false, 50, 0);
        ReflectionTestUtils.setField(owner.getPlan(), "maxMembers", (short) -1);
        TeamMember ownerMember = mock(TeamMember.class);
        when(ownerMember.getUser()).thenReturn(owner);

        when(teamMemberRepository.findOwnerByProjectId(projectId)).thenReturn(Optional.of(ownerMember));

        assertThatCode(() -> planChecker.canAddMember(projectId)).doesNotThrowAnyException();
    }

    private User userWithPlan(boolean allowDast, int sastLimit, int sastUsed) {
        Plan plan = new Plan();
        ReflectionTestUtils.setField(plan, "allowDast", allowDast);
        ReflectionTestUtils.setField(plan, "monthlySastLimit", sastLimit);
        ReflectionTestUtils.setField(plan, "maxMembers", (short) 1);

        User user = User.builder()
                .email("owner@example.com")
                .username("owner")
                .emailVerified(true)
                .plan(plan)
                .build();
        ReflectionTestUtils.setField(user, "sastUsageThisMonth", sastUsed);
        return user;
    }
}
