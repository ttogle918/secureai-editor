package io.secureai.backend.domain.cleanup;

import io.secureai.backend.domain.cleanup.service.SastUsageResetJob;
import io.secureai.backend.domain.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class SastUsageResetJobTest {

    @Mock
    UserRepository userRepository;

    @InjectMocks
    SastUsageResetJob job;

    @Test
    void resetMonthlyUsage_리셋건수_로그_정상() {
        given(userRepository.resetMonthlySastUsage()).willReturn(100);

        assertDoesNotThrow(() -> job.resetMonthlyUsage());

        verify(userRepository).resetMonthlySastUsage();
    }

    @Test
    void resetMonthlyUsage_사용자_없음_정상() {
        given(userRepository.resetMonthlySastUsage()).willReturn(0);

        assertDoesNotThrow(() -> job.resetMonthlyUsage());

        verify(userRepository).resetMonthlySastUsage();
    }
}
