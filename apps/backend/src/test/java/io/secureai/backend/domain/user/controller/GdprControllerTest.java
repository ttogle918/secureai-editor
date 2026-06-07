package io.secureai.backend.domain.user.controller;

import io.secureai.backend.domain.user.dto.GdprDeleteRequest;
import io.secureai.backend.domain.user.dto.GdprExportResponse;
import io.secureai.backend.domain.user.dto.GdprPendingDeletionResponse;
import io.secureai.backend.domain.user.service.GdprHardDeleteService;
import io.secureai.backend.domain.user.service.GdprService;
import io.secureai.backend.global.response.ApiResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;

import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * GdprController 단위 테스트 — 데이터 이동권(export)/삭제권(delete) 위임과
 * 관리자 전용 대기열 조회를 검증한다. userId 는 @AuthenticationPrincipal 에서만
 * 받으므로 위임 인자로 확인한다.
 */
@ExtendWith(MockitoExtension.class)
class GdprControllerTest {

    @Mock GdprService gdprService;
    @Mock GdprHardDeleteService gdprHardDeleteService;

    private GdprController controller;
    private final UUID userId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        controller = new GdprController(gdprService, gdprHardDeleteService);
    }

    @Test
    @DisplayName("exportData — 인증 주체의 데이터를 내보내 200 으로 반환한다")
    void exportData_returnsExport() {
        GdprExportResponse expected = mock(GdprExportResponse.class);
        when(gdprService.exportData(userId)).thenReturn(expected);

        ResponseEntity<ApiResponse<GdprExportResponse>> response = controller.exportData(userId);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().getData()).isSameAs(expected);
    }

    @Test
    @DisplayName("deleteAccount — 확인 비밀번호로 소프트 삭제를 위임하고 204 를 반환한다")
    void deleteAccount_passesConfirmPassword() {
        ResponseEntity<Void> response =
                controller.deleteAccount(userId, new GdprDeleteRequest("confirm-pw"));

        assertThat(response.getStatusCode().value()).isEqualTo(204);
        verify(gdprService).deleteAccount(userId, "confirm-pw");
    }

    @Test
    @DisplayName("getPendingDeletions — 페이지 요청을 서비스에 위임하고 결과를 200 으로 반환한다")
    void getPendingDeletions_delegatesPageable() {
        Pageable pageable = PageRequest.of(0, 20);
        @SuppressWarnings("unchecked")
        Page<GdprPendingDeletionResponse> page = mock(Page.class);
        when(gdprHardDeleteService.getPendingDeletions(pageable)).thenReturn(page);

        ResponseEntity<ApiResponse<Page<GdprPendingDeletionResponse>>> response =
                controller.getPendingDeletions(pageable);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().getData()).isSameAs(page);
        verify(gdprHardDeleteService).getPendingDeletions(pageable);
    }
}
