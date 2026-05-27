package io.secureai.backend.domain.scheduling.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class NightlyScanJobTest {

    @Mock
    NightlyScanService nightlyScanService;

    @InjectMocks
    NightlyScanJob job;

    @Test
    void runNightlyScan_호출시_scanActiveProjects_1회_실행() {
        assertDoesNotThrow(() -> job.runNightlyScan());

        verify(nightlyScanService).scanActiveProjects();
    }
}
