package io.secureai.backend.domain.admin.controller;

import io.secureai.backend.domain.admin.dto.AdminCreditRequest;
import io.secureai.backend.domain.admin.dto.AdminPlanChangeRequest;
import io.secureai.backend.domain.admin.dto.AdminUserResponse;
import io.secureai.backend.domain.admin.service.AdminService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AdminControllerTest {

    @Mock AdminService adminService;

    private AdminController controller;
    private final UUID adminId = UUID.randomUUID();
    private final UUID userId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        controller = new AdminController(adminService);
    }

    @Test
    @DisplayName("listUsers — 필터/페이지를 위임하고 200 을 반환한다")
    void listUsers_delegates() {
        Pageable pageable = PageRequest.of(0, 20);
        @SuppressWarnings("unchecked")
        Page<AdminUserResponse> page = mock(Page.class);
        when(adminService.listUsers("alice", (short) 1, true, pageable)).thenReturn(page);

        var response = controller.listUsers("alice", (short) 1, true, pageable, adminId);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().getData()).isSameAs(page);
    }

    @Test
    @DisplayName("changeUserPlan — 플랜 변경을 위임하고 갱신된 사용자를 다시 조회해 반환한다")
    void changeUserPlan_appliesThenReloads() {
        AdminPlanChangeRequest req = new AdminPlanChangeRequest((short) 2, "upgrade");
        AdminUserResponse updated = mock(AdminUserResponse.class);
        when(adminService.getUser(userId)).thenReturn(updated);

        var response = controller.changeUserPlan(userId, req, adminId);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().getData()).isSameAs(updated);
        verify(adminService).changeUserPlan(userId, (short) 2, "upgrade", adminId);
        verify(adminService).getUser(userId);
    }

    @Test
    @DisplayName("toggleUserActive — 활성 상태 변경을 위임하고 갱신된 사용자를 반환한다")
    void toggleUserActive_appliesThenReloads() {
        AdminUserResponse updated = mock(AdminUserResponse.class);
        when(adminService.getUser(userId)).thenReturn(updated);

        var response = controller.toggleUserActive(userId, false, adminId);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        verify(adminService).toggleUserActive(userId, false, adminId);
    }

    @Test
    @DisplayName("adjustCredits — 조정 후 잔액을 balanceAfter 로 반환한다")
    void adjustCredits_returnsBalanceAfter() {
        AdminCreditRequest req = new AdminCreditRequest(500, "manual grant");
        when(adminService.adjustCredits(userId, 500, "manual grant", adminId)).thenReturn(600);

        var response = controller.adjustCredits(userId, req, adminId);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().getData()).containsEntry("balanceAfter", 600);
    }
}
