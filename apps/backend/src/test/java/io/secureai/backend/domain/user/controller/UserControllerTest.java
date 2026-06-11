package io.secureai.backend.domain.user.controller;

import io.secureai.backend.domain.user.dto.*;
import io.secureai.backend.domain.user.service.UserService;
import io.secureai.backend.global.response.ApiResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * UserController 단위 테스트 — DastControllerTest 컨벤션(MockMvc 미사용)을 따른다.
 * 인증 주체(userId)와 요청 본문이 서비스로 올바르게 위임되는지, 상태코드와
 * 응답 페이로드가 맞는지 검증한다.
 */
@ExtendWith(MockitoExtension.class)
class UserControllerTest {

    @Mock UserService userService;

    private UserController controller;
    private final UUID userId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        controller = new UserController(userService);
    }

    @Test
    @DisplayName("getMe — 인증 주체로 조회한 결과를 200 으로 반환한다")
    void getMe_returnsCurrentUser() {
        UserMeResponse me = mock(UserMeResponse.class);
        when(userService.getMe(userId)).thenReturn(me);

        ResponseEntity<ApiResponse<UserMeResponse>> response = controller.getMe(userId);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().getData()).isSameAs(me);
    }

    @Test
    @DisplayName("updateMe — 요청 본문을 서비스에 위임하고 갱신 결과를 반환한다")
    void updateMe_delegates() {
        UpdateUserRequest req = mock(UpdateUserRequest.class);
        UserMeResponse updated = mock(UserMeResponse.class);
        when(userService.updateMe(userId, req)).thenReturn(updated);

        ResponseEntity<ApiResponse<UserMeResponse>> response = controller.updateMe(userId, req);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().getData()).isSameAs(updated);
    }

    @Test
    @DisplayName("updateWorkspaceMode — 올바른 모드를 서비스에 위임하고 갱신 결과를 반환한다")
    void updateWorkspaceMode_delegates() {
        UpdateWorkspaceModeRequest req = new UpdateWorkspaceModeRequest("SECURITY_MANAGER");
        UserMeResponse updated = mock(UserMeResponse.class);
        when(userService.updateWorkspaceMode(userId, "SECURITY_MANAGER")).thenReturn(updated);

        ResponseEntity<ApiResponse<UserMeResponse>> response = controller.updateWorkspaceMode(userId, req);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().getData()).isSameAs(updated);
    }

    @Test
    @DisplayName("changePassword — current/new 비밀번호를 서비스에 전달하고 204 를 반환한다")
    void changePassword_passesBothPasswords() {
        ChangePasswordRequest req = mock(ChangePasswordRequest.class);
        when(req.getCurrentPassword()).thenReturn("old-pw");
        when(req.getNewPassword()).thenReturn("new-pw");

        ResponseEntity<Void> response = controller.changePassword(userId, req);

        assertThat(response.getStatusCode().value()).isEqualTo(204);
        verify(userService).changePassword(userId, "old-pw", "new-pw");
    }

    @Test
    @DisplayName("deleteMe — 확인 비밀번호로 탈퇴를 위임하고 204 를 반환한다")
    void deleteMe_passesConfirmPassword() {
        DeleteMeRequest req = mock(DeleteMeRequest.class);
        when(req.getConfirmPassword()).thenReturn("confirm-pw");

        ResponseEntity<Void> response = controller.deleteMe(userId, req);

        assertThat(response.getStatusCode().value()).isEqualTo(204);
        verify(userService).deleteMe(userId, "confirm-pw");
    }

    @Test
    @DisplayName("saveApiKey — 키를 저장하고 hasByok=true 를 반환한다")
    void saveApiKey_returnsHasByokTrue() {
        SaveApiKeyRequest req = new SaveApiKeyRequest("sk-user-key");

        ResponseEntity<ApiResponse<Map<String, Boolean>>> response = controller.saveApiKey(userId, req);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().getData()).containsEntry("hasByok", true);
        verify(userService).saveApiKey(userId, "sk-user-key");
    }

    @Test
    @DisplayName("removeApiKey — 키를 제거하고 hasByok=false 를 반환한다")
    void removeApiKey_returnsHasByokFalse() {
        ResponseEntity<ApiResponse<Map<String, Boolean>>> response = controller.removeApiKey(userId);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().getData()).containsEntry("hasByok", false);
        verify(userService).removeApiKey(userId);
    }

    @Test
    @DisplayName("saveGithubSettings — blockMergeOnCritical 설정을 저장하고 그대로 반환한다")
    void saveGithubSettings_echoesFlag() {
        GitHubSettingsRequest req = new GitHubSettingsRequest(true);

        ResponseEntity<ApiResponse<Map<String, Boolean>>> response = controller.saveGithubSettings(userId, req);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().getData()).containsEntry("blockMergeOnCritical", true);
        verify(userService).saveGithubSettings(userId, req);
    }

    @Test
    @DisplayName("getCredits — 크레딧 요약을 200 으로 반환한다")
    void getCredits_returnsSummary() {
        CreditSummaryResponse summary = mock(CreditSummaryResponse.class);
        when(userService.getCredits(userId)).thenReturn(summary);

        ResponseEntity<ApiResponse<CreditSummaryResponse>> response = controller.getCredits(userId);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().getData()).isSameAs(summary);
    }
}
