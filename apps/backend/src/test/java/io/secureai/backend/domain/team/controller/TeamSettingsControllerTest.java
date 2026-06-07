package io.secureai.backend.domain.team.controller;

import io.secureai.backend.domain.team.dto.IpAllowlistRequest;
import io.secureai.backend.domain.team.service.TeamSettingsService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TeamSettingsControllerTest {

    @Mock TeamSettingsService teamSettingsService;

    private TeamSettingsController controller;

    @BeforeEach
    void setUp() {
        controller = new TeamSettingsController(teamSettingsService);
    }

    @Test
    @DisplayName("updateIpAllowlist — CIDR 목록을 서비스에 위임하고 200 을 반환한다")
    void updateIpAllowlist_delegates() {
        UUID teamId = UUID.randomUUID();
        List<String> ranges = List.of("10.0.0.0/8", "192.168.1.0/24");

        var response = controller.updateIpAllowlist(teamId, new IpAllowlistRequest(ranges));

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        verify(teamSettingsService).updateIpAllowlist(teamId, ranges);
    }
}
