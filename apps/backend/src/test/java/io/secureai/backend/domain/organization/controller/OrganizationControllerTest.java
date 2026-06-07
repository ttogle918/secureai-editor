package io.secureai.backend.domain.organization.controller;

import io.secureai.backend.domain.organization.dto.*;
import io.secureai.backend.domain.organization.service.InvitationService;
import io.secureai.backend.domain.organization.service.OrganizationService;
import io.secureai.backend.global.response.ApiResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * OrganizationController 단위 테스트 — 조직 CRUD 및 멤버 관리의 위임/상태코드를
 * 확인한다. acting userId 는 @AuthenticationPrincipal, slug 는 경로에서 받으며
 * 멤버 작업에서 대상 userId/role 이 분리되어 서비스로 전달되는지 검증한다.
 */
@ExtendWith(MockitoExtension.class)
class OrganizationControllerTest {

    @Mock OrganizationService organizationService;
    @Mock InvitationService invitationService;

    private OrganizationController controller;
    private final UUID actingUserId = UUID.randomUUID();
    private static final String SLUG = "acme";

    @BeforeEach
    void setUp() {
        controller = new OrganizationController(organizationService, invitationService);
    }

    @Test
    @DisplayName("listMyOrgs — 내 조직 목록을 200 으로 반환한다")
    void listMyOrgs_delegates() {
        List<OrgResponse> orgs = List.of(mock(OrgResponse.class));
        when(organizationService.listMyOrgs(actingUserId)).thenReturn(orgs);

        var response = controller.listMyOrgs(actingUserId);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().getData()).hasSize(1);
    }

    @Test
    @DisplayName("createOrg — 생성 결과를 201 CREATED 로 반환한다")
    void createOrg_returns201() {
        CreateOrgRequest req = mock(CreateOrgRequest.class);
        OrgResponse created = mock(OrgResponse.class);
        when(organizationService.createOrg(actingUserId, req)).thenReturn(created);

        var response = controller.createOrg(actingUserId, req);

        assertThat(response.getStatusCode().value()).isEqualTo(201);
        assertThat(response.getBody().getData()).isSameAs(created);
    }

    @Test
    @DisplayName("deleteOrg — slug + acting userId 로 삭제를 위임하고 204 를 반환한다")
    void deleteOrg_returns204() {
        ResponseEntity<Void> response = controller.deleteOrg(SLUG, actingUserId);

        assertThat(response.getStatusCode().value()).isEqualTo(204);
        verify(organizationService).deleteOrg(SLUG, actingUserId);
    }

    @Test
    @DisplayName("addMember — 요청의 대상 userId/role 과 acting userId 를 분리해 서비스에 전달하고 201 을 반환한다")
    void addMember_passesTargetAndActor() {
        UUID targetUserId = UUID.randomUUID();
        OrganizationController.AddMemberRequest req =
                new OrganizationController.AddMemberRequest(targetUserId, "MEMBER");
        OrgMemberResponse added = mock(OrgMemberResponse.class);
        when(organizationService.addMember(SLUG, targetUserId, "MEMBER", actingUserId)).thenReturn(added);

        var response = controller.addMember(SLUG, actingUserId, req);

        assertThat(response.getStatusCode().value()).isEqualTo(201);
        verify(organizationService).addMember(SLUG, targetUserId, "MEMBER", actingUserId);
    }

    @Test
    @DisplayName("changeMemberRole — 대상 멤버의 새 role 을 위임하고 200 을 반환한다")
    void changeMemberRole_delegates() {
        UUID targetUserId = UUID.randomUUID();
        OrganizationController.RoleChangeRequest req =
                new OrganizationController.RoleChangeRequest("ADMIN");
        OrgMemberResponse updated = mock(OrgMemberResponse.class);
        when(organizationService.changeMemberRole(SLUG, targetUserId, "ADMIN", actingUserId)).thenReturn(updated);

        var response = controller.changeMemberRole(SLUG, targetUserId, actingUserId, req);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        verify(organizationService).changeMemberRole(SLUG, targetUserId, "ADMIN", actingUserId);
    }

    @Test
    @DisplayName("removeMember — 대상 멤버 제거를 위임하고 204 를 반환한다")
    void removeMember_returns204() {
        UUID targetUserId = UUID.randomUUID();

        ResponseEntity<Void> response = controller.removeMember(SLUG, targetUserId, actingUserId);

        assertThat(response.getStatusCode().value()).isEqualTo(204);
        verify(organizationService).removeMember(SLUG, targetUserId, actingUserId);
    }

    @Test
    @DisplayName("inviteByEmail — 초대를 위임하고 202 ACCEPTED 를 반환한다")
    void inviteByEmail_returns202() {
        InviteMemberRequest req = mock(InviteMemberRequest.class);

        ResponseEntity<Void> response = controller.inviteByEmail(SLUG, actingUserId, req);

        assertThat(response.getStatusCode().value()).isEqualTo(202);
        verify(invitationService).inviteByEmail(SLUG, req, actingUserId);
    }

    @Test
    @DisplayName("getOrgUsage — 사용량 요약을 200 으로 반환한다")
    void getOrgUsage_delegates() {
        OrgUsageResponse usage = mock(OrgUsageResponse.class);
        when(organizationService.getOrgUsage(SLUG, actingUserId)).thenReturn(usage);

        var response = controller.getOrgUsage(SLUG, actingUserId);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().getData()).isSameAs(usage);
    }
}
