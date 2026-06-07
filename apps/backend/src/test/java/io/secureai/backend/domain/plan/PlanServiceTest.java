package io.secureai.backend.domain.plan;

import io.secureai.backend.global.exception.BusinessException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PlanServiceTest {

    @Mock PlanRepository planRepository;

    @InjectMocks PlanService planService;

    @Test
    @DisplayName("findByName — 플랜이 존재하면 반환한다")
    void findByName_found_returnsPlan() {
        Plan plan = mock(Plan.class);
        when(planRepository.findByName("free")).thenReturn(Optional.of(plan));

        assertThat(planService.findByName("free")).isSameAs(plan);
    }

    @Test
    @DisplayName("findByName — 플랜이 없으면 BusinessException")
    void findByName_missing_throws() {
        when(planRepository.findByName("ghost")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> planService.findByName("ghost"))
                .isInstanceOf(BusinessException.class);
    }
}
