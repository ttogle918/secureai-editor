package io.secureai.backend.domain.auth.service;

import io.secureai.backend.domain.auth.entity.EmailSuppression;
import io.secureai.backend.domain.auth.entity.SuppressionReason;
import io.secureai.backend.domain.auth.repository.EmailSuppressionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EmailSuppressionServiceTest {

    @Mock EmailSuppressionRepository suppressionRepository;
    @Captor ArgumentCaptor<EmailSuppression> suppressionCaptor;

    private EmailSuppressionService service;

    @BeforeEach
    void setUp() {
        service = new EmailSuppressionService(suppressionRepository);
    }

    @Test
    @DisplayName("미등록 주소 suppression 요청 → 저장소에 등록한다")
    void suppress_newAddress_savesEntry() {
        when(suppressionRepository.existsByEmailAddress("new@x.com")).thenReturn(false);

        service.suppress("new@x.com", SuppressionReason.BOUNCE);

        verify(suppressionRepository).save(suppressionCaptor.capture());
        assertThat(suppressionCaptor.getValue().getEmailAddress()).isEqualTo("new@x.com");
        assertThat(suppressionCaptor.getValue().getReason()).isEqualTo(SuppressionReason.BOUNCE);
    }

    @Test
    @DisplayName("이미 등록된 주소 suppression 요청 → 중복 등록하지 않는다 (idempotent)")
    void suppress_existingAddress_skipsRegistration() {
        when(suppressionRepository.existsByEmailAddress("dup@x.com")).thenReturn(true);

        service.suppress("dup@x.com", SuppressionReason.COMPLAINT);

        verify(suppressionRepository, never()).save(any());
    }
}
