package io.secureai.backend.domain.scheduling.controller;

import io.secureai.backend.domain.scheduling.dto.ProjectScheduleRequest;
import io.secureai.backend.domain.scheduling.dto.ProjectScheduleResponse;
import io.secureai.backend.domain.scheduling.service.ProjectScheduleService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProjectScheduleControllerTest {

    @Mock
    private ProjectScheduleService projectScheduleService;

    private ProjectScheduleController controller;

    private final UUID userId = UUID.randomUUID();
    private final UUID projectId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        controller = new ProjectScheduleController(projectScheduleService);
    }

    @Test
    @DisplayName("getSchedule — 서비스 결과를 200 ApiResponse로 감싸 반환한다")
    void getSchedule_delegatesAndWraps() {
        ProjectScheduleResponse expected = new ProjectScheduleResponse(
                UUID.randomUUID(), projectId, true, Instant.now(), 1);
        when(projectScheduleService.getSchedule(userId, projectId)).thenReturn(expected);

        var response = controller.getSchedule(userId, projectId);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getData()).isSameAs(expected);
        verify(projectScheduleService).getSchedule(userId, projectId);
    }

    @Test
    @DisplayName("upsertSchedule — 요청을 서비스에 위임하고 200 ApiResponse로 감싸 반환한다")
    void upsertSchedule_delegatesAndWraps() {
        ProjectScheduleRequest request = new ProjectScheduleRequest(true, 14);
        ProjectScheduleResponse expected = new ProjectScheduleResponse(
                UUID.randomUUID(), projectId, true, null, 14);
        when(projectScheduleService.upsertSchedule(userId, projectId, request)).thenReturn(expected);

        var response = controller.upsertSchedule(userId, projectId, request);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getData()).isSameAs(expected);
        verify(projectScheduleService).upsertSchedule(userId, projectId, request);
    }
}
