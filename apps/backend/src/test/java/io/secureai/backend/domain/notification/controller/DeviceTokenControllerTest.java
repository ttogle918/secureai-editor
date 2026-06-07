package io.secureai.backend.domain.notification.controller;

import io.secureai.backend.domain.notification.dto.DeviceTokenRequest;
import io.secureai.backend.domain.notification.service.DeviceTokenService;
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
class DeviceTokenControllerTest {

    @Mock DeviceTokenService deviceTokenService;

    private DeviceTokenController controller;
    private final UUID userId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        controller = new DeviceTokenController(deviceTokenService);
    }

    @Test
    @DisplayName("registerToken — 토큰을 등록하고 201 을 반환한다")
    void registerToken_returns201() {
        var response = controller.registerToken(userId, new DeviceTokenRequest("fcm-token-1"));

        assertThat(response.getStatusCode().value()).isEqualTo(201);
        verify(deviceTokenService).registerToken(userId, "fcm-token-1");
    }

    @Test
    @DisplayName("removeToken — 토큰을 삭제하고 200 을 반환한다")
    void removeToken_returns200() {
        var response = controller.removeToken(userId, new DeviceTokenRequest("fcm-token-1"));

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        verify(deviceTokenService).removeToken(userId, "fcm-token-1");
    }
}
