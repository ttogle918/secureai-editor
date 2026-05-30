package io.secureai.backend.domain.cve.controller;

import io.secureai.backend.domain.cve.dto.CveSearchResponse;
import io.secureai.backend.domain.cve.service.CveSearchService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CveSearchControllerTest {

    @Mock CveSearchService cveSearchService;

    private CveSearchController controller;

    @BeforeEach
    void setUp() {
        controller = new CveSearchController(cveSearchService);
    }

    @Test
    @DisplayName("search — 패키지명/버전으로 검색하고 cves 키로 감싼 결과를 200 으로 반환한다")
    void search_wrapsResultsUnderCvesKey() {
        List<CveSearchResponse> cves = List.of(mock(CveSearchResponse.class), mock(CveSearchResponse.class));
        when(cveSearchService.search("lodash", "4.17.20")).thenReturn(cves);

        var response = controller.search("lodash", "4.17.20");

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().getData()).containsKey("cves");
        assertThat(response.getBody().getData().get("cves")).hasSize(2);
        verify(cveSearchService).search("lodash", "4.17.20");
    }
}
