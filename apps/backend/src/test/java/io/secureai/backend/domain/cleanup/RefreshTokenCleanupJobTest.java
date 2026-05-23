package io.secureai.backend.domain.cleanup;

import io.secureai.backend.domain.cleanup.service.RefreshTokenCleanupJob;
import io.secureai.backend.domain.user.repository.RefreshTokenRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class RefreshTokenCleanupJobTest {

    @Mock
    RefreshTokenRepository refreshTokenRepository;

    @InjectMocks
    RefreshTokenCleanupJob job;

    @Test
    void cleanupExpiredTokens_삭제건수_로그_정상() {
        given(refreshTokenRepository.deleteExpiredAndRevoked(any())).willReturn(5);

        assertDoesNotThrow(() -> job.cleanupExpiredTokens());

        verify(refreshTokenRepository).deleteExpiredAndRevoked(any());
    }

    @Test
    void cleanupExpiredTokens_삭제건수_0건_정상() {
        given(refreshTokenRepository.deleteExpiredAndRevoked(any())).willReturn(0);

        assertDoesNotThrow(() -> job.cleanupExpiredTokens());

        verify(refreshTokenRepository).deleteExpiredAndRevoked(any());
    }
}
