package io.secureai.backend.domain.organization.controller;

import io.secureai.backend.domain.organization.entity.TeamInvitation;
import io.secureai.backend.domain.organization.service.InvitationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.time.OffsetDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * InvitationController 단위 테스트 — 초대 조회 시 엔티티를 응답 DTO 로 매핑하는지,
 * 수락이 인증 주체로 위임되는지 검증한다.
 */
@ExtendWith(MockitoExtension.class)
class InvitationControllerTest {

    @Mock InvitationService invitationService;

    private InvitationController controller;

    @BeforeEach
    void setUp() {
        controller = new InvitationController(invitationService);
    }

    @Test
    @DisplayName("getInvitationInfo — 토큰으로 조회한 초대 엔티티를 응답 DTO 로 매핑한다")
    void getInvitationInfo_mapsEntity() {
        UUID orgId = UUID.randomUUID();
        UUID projectId = UUID.randomUUID();
        OffsetDateTime expiresAt = OffsetDateTime.now().plusDays(3);

        TeamInvitation invitation = mock(TeamInvitation.class);
        when(invitation.getOrgId()).thenReturn(orgId);
        when(invitation.getProjectId()).thenReturn(projectId);
        when(invitation.getEmail()).thenReturn("invitee@x.com");
        when(invitation.getRole()).thenReturn("MEMBER");
        when(invitation.getExpiresAt()).thenReturn(expiresAt);
        when(invitationService.getInvitationInfo("tok-1")).thenReturn(invitation);

        var response = controller.getInvitationInfo("tok-1");

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        var data = response.getBody().getData();
        assertThat(data.orgId()).isEqualTo(orgId);
        assertThat(data.projectId()).isEqualTo(projectId);
        assertThat(data.email()).isEqualTo("invitee@x.com");
        assertThat(data.role()).isEqualTo("MEMBER");
        assertThat(data.expiresAt()).isEqualTo(expiresAt.toString());
    }

    @Test
    @DisplayName("acceptInvitation — 토큰과 인증 주체로 수락을 위임하고 204 를 반환한다")
    void acceptInvitation_returns204() {
        UUID userId = UUID.randomUUID();

        ResponseEntity<Void> response = controller.acceptInvitation("tok-1", userId);

        assertThat(response.getStatusCode().value()).isEqualTo(204);
        verify(invitationService).acceptInvitation("tok-1", userId);
    }
}
