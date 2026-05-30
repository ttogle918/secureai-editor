package io.secureai.backend.domain.dashboard.controller;

import io.secureai.backend.domain.dashboard.dto.DashboardResponse;
import io.secureai.backend.domain.dashboard.dto.TeamDashboardResponse;
import io.secureai.backend.domain.dashboard.service.DashboardQueryService;
import io.secureai.backend.domain.dashboard.service.TeamDashboardService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DashboardControllerTest {

    @Mock DashboardQueryService dashboardQueryService;
    @Mock TeamDashboardService teamDashboardService;

    private DashboardController controller;
    private final UUID userId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        controller = new DashboardController(dashboardQueryService, teamDashboardService);
    }

    @Test
    @DisplayName("getDashboard — userId + projectId 로 위임하고 200 을 반환한다")
    void getDashboard_delegates() {
        UUID projectId = UUID.randomUUID();
        DashboardResponse expected = mock(DashboardResponse.class);
        when(dashboardQueryService.getDashboard(userId, projectId)).thenReturn(expected);

        var response = controller.getDashboard(userId, projectId);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().getData()).isSameAs(expected);
    }

    @Test
    @DisplayName("getTeamDashboard — teamId + userId 로 위임하고 200 을 반환한다")
    void getTeamDashboard_delegates() {
        UUID teamId = UUID.randomUUID();
        TeamDashboardResponse expected = mock(TeamDashboardResponse.class);
        when(teamDashboardService.getTeamDashboard(teamId, userId)).thenReturn(expected);

        var response = controller.getTeamDashboard(userId, teamId);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().getData()).isSameAs(expected);
    }
}
