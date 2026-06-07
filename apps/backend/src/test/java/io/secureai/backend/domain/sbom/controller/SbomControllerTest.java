package io.secureai.backend.domain.sbom.controller;

import io.secureai.backend.domain.sbom.dto.CycloneDxBom;
import io.secureai.backend.domain.sbom.dto.SaveComponentsRequest;
import io.secureai.backend.domain.sbom.dto.SbomComponentResponse;
import io.secureai.backend.domain.sbom.service.CycloneDxExportService;
import io.secureai.backend.domain.sbom.service.SbomService;
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
class SbomControllerTest {

    @Mock SbomService sbomService;
    @Mock CycloneDxExportService cycloneDxExportService;

    private SbomController controller;
    private final UUID userId = UUID.randomUUID();
    private final UUID projectId = UUID.randomUUID();
    private final UUID sessionId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        controller = new SbomController(sbomService, cycloneDxExportService);
    }

    @Test
    @DisplayName("saveComponents — 저장 건수를 201 의 saved 필드로 반환한다")
    void saveComponents_returns201() {
        SaveComponentsRequest req = mock(SaveComponentsRequest.class);
        when(sbomService.saveComponents(req)).thenReturn(7);

        var response = controller.saveComponents(req);

        assertThat(response.getStatusCode().value()).isEqualTo(201);
        assertThat(response.getBody().getData()).containsEntry("saved", 7);
    }

    @Test
    @DisplayName("getComponents — projectId/sessionId/userId 로 위임하고 200 을 반환한다")
    void getComponents_delegates() {
        List<SbomComponentResponse> components = List.of(mock(SbomComponentResponse.class));
        when(sbomService.getComponents(projectId, sessionId, userId)).thenReturn(components);

        var response = controller.getComponents(projectId, sessionId, userId);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().getData()).hasSize(1);
    }

    @Test
    @DisplayName("exportCycloneDx — CycloneDX BOM 을 200 으로 반환한다")
    void exportCycloneDx_delegates() {
        CycloneDxBom bom = mock(CycloneDxBom.class);
        when(cycloneDxExportService.exportCycloneDx(projectId, sessionId, userId)).thenReturn(bom);

        var response = controller.exportCycloneDx(projectId, sessionId, userId);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().getData()).isSameAs(bom);
    }
}
