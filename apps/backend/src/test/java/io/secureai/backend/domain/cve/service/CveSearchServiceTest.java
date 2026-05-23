package io.secureai.backend.domain.cve.service;

import io.secureai.backend.domain.cve.dto.CveSearchResponse;
import io.secureai.backend.domain.cve.entity.CveData;
import io.secureai.backend.domain.cve.repository.CveDataRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CveSearchServiceTest {

    @Mock
    CveDataRepository cveDataRepository;

    @InjectMocks
    CveSearchService service;

    private CveData sampleCve;

    @BeforeEach
    void setUp() {
        sampleCve = CveData.builder()
                .cveId("CVE-2021-44228")
                .description("Log4Shell Remote Code Execution vulnerability.")
                .cvssScore(new BigDecimal("10.0"))
                .cvssVector("CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H")
                .severity("CRITICAL")
                .affectedProducts("[]")
                .build();
    }

    @Test
    @DisplayName("search — packageName으로 CVE를 조회하고 응답 DTO로 변환한다")
    void search_returns_cve_list_for_package_name() {
        // given
        when(cveDataRepository.findByPackageName("log4j")).thenReturn(List.of(sampleCve));

        // when
        List<CveSearchResponse> result = service.search("log4j", null);

        // then
        assertThat(result).hasSize(1);
        CveSearchResponse resp = result.get(0);
        assertThat(resp.cveId()).isEqualTo("CVE-2021-44228");
        assertThat(resp.severity()).isEqualTo("CRITICAL");
        assertThat(resp.cvssScore()).isEqualByComparingTo(new BigDecimal("10.0"));
        verify(cveDataRepository).findByPackageName("log4j");
    }

    @Test
    @DisplayName("search — 매칭 CVE 없으면 빈 목록을 반환한다")
    void search_returns_empty_when_no_cve_found() {
        // given
        when(cveDataRepository.findByPackageName("unknown-package")).thenReturn(List.of());

        // when
        List<CveSearchResponse> result = service.search("unknown-package", "1.0.0");

        // then
        assertThat(result).isEmpty();
    }

    @Test
    @DisplayName("search — version 파라미터는 현재 미사용이지만 예외 없이 동작한다")
    void search_with_version_does_not_throw() {
        // given
        when(cveDataRepository.findByPackageName("spring-core")).thenReturn(List.of());

        // when / then
        assertThatCode(() -> service.search("spring-core", "5.3.10"))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("search — 여러 CVE가 매칭되면 모두 반환한다")
    void search_returns_multiple_cves() {
        // given
        CveData anotherCve = CveData.builder()
                .cveId("CVE-2019-17571")
                .description("Log4j 1.2 deserialization vulnerability.")
                .cvssScore(new BigDecimal("9.8"))
                .severity("CRITICAL")
                .affectedProducts("[]")
                .build();

        when(cveDataRepository.findByPackageName("log4j")).thenReturn(List.of(sampleCve, anotherCve));

        // when
        List<CveSearchResponse> result = service.search("log4j", null);

        // then
        assertThat(result).hasSize(2);
        assertThat(result).extracting(CveSearchResponse::cveId)
                .containsExactlyInAnyOrder("CVE-2021-44228", "CVE-2019-17571");
    }
}
