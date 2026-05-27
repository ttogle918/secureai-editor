package io.secureai.backend.domain.sbom.service;

import io.secureai.backend.domain.cve.dto.CveSearchResponse;
import io.secureai.backend.domain.cve.service.CveSearchService;
import io.secureai.backend.domain.project.entity.Project;
import io.secureai.backend.domain.project.repository.ProjectRepository;
import io.secureai.backend.domain.project.repository.TeamMemberRepository;
import io.secureai.backend.domain.sbom.dto.CycloneDxBom;
import io.secureai.backend.domain.sbom.entity.DependencyComponent;
import io.secureai.backend.domain.sbom.repository.DependencyComponentRepository;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CycloneDxExportServiceTest {

    @Mock DependencyComponentRepository componentRepository;
    @Mock ProjectRepository              projectRepository;
    @Mock TeamMemberRepository           teamMemberRepository;
    @Mock CveSearchService               cveSearchService;

    @InjectMocks CycloneDxExportService service;

    private UUID projectId;
    private UUID sessionId;
    private UUID userId;
    private Project project;

    @BeforeEach
    void setUp() {
        projectId = UUID.randomUUID();
        sessionId = UUID.randomUUID();
        userId    = UUID.randomUUID();
        project   = mock(Project.class);
    }

    // ─── bomFormat / specVersion 검증 ─────────────────────────────────────────

    @Test
    @DisplayName("컴포넌트가 있을 때 bomFormat=CycloneDX, specVersion=1.4 를 반환한다")
    void exportCycloneDx_returnsCorrectBomFormatAndSpecVersion() {
        // given
        DependencyComponent comp = buildComponent("maven", null, "spring-core", "5.3.10");
        stubAccess(true);
        when(componentRepository.findBySession_Id(sessionId)).thenReturn(List.of(comp));
        when(cveSearchService.search(anyString(), any())).thenReturn(List.of());

        // when
        CycloneDxBom bom = service.exportCycloneDx(projectId, sessionId, userId);

        // then
        assertThat(bom.bomFormat()).isEqualTo("CycloneDX");
        assertThat(bom.specVersion()).isEqualTo("1.4");
        assertThat(bom.version()).isEqualTo(1);
    }

    @Test
    @DisplayName("serialNumber 는 urn:uuid: 접두사를 포함하며 호출마다 고유하다")
    void exportCycloneDx_serialNumberIsUniqueUrnUuid() {
        // given
        stubAccess(true);
        when(componentRepository.findBySession_Id(sessionId)).thenReturn(List.of());

        // when
        CycloneDxBom bom1 = service.exportCycloneDx(projectId, sessionId, userId);
        CycloneDxBom bom2 = service.exportCycloneDx(projectId, sessionId, userId);

        // then
        assertThat(bom1.serialNumber()).startsWith("urn:uuid:");
        assertThat(bom1.serialNumber()).isNotEqualTo(bom2.serialNumber());
    }

    // ─── 컴포넌트 없음 ────────────────────────────────────────────────────────

    @Test
    @DisplayName("컴포넌트가 없을 때 빈 components 배열을 반환한다")
    void exportCycloneDx_returnsEmptyComponentsWhenNone() {
        // given
        stubAccess(true);
        when(componentRepository.findBySession_Id(sessionId)).thenReturn(List.of());

        // when
        CycloneDxBom bom = service.exportCycloneDx(projectId, sessionId, userId);

        // then
        assertThat(bom.components()).isEmpty();
        assertThat(bom.vulnerabilities()).isEmpty();
    }

    // ─── bom-ref 포맷 ────────────────────────────────────────────────────────

    @Test
    @DisplayName("groupId 가 있는 Maven 컴포넌트의 bom-ref 는 pkg:maven/groupId:artifactId@version 형식이다")
    void exportCycloneDx_bomRefIncludesGroupIdForMaven() {
        // given
        DependencyComponent comp = buildComponent("maven", "org.springframework", "spring-core", "5.3.10");
        stubAccess(true);
        when(componentRepository.findBySession_Id(sessionId)).thenReturn(List.of(comp));
        when(cveSearchService.search(anyString(), any())).thenReturn(List.of());

        // when
        CycloneDxBom bom = service.exportCycloneDx(projectId, sessionId, userId);

        // then
        assertThat(bom.components()).hasSize(1);
        CycloneDxBom.Component component = bom.components().get(0);
        assertThat(component.bomRef()).isEqualTo("pkg:maven/org.springframework:spring-core@5.3.10");
        assertThat(component.name()).isEqualTo("org.springframework:spring-core");
        assertThat(component.type()).isEqualTo("library");
    }

    @Test
    @DisplayName("groupId 가 없는 컴포넌트의 bom-ref 는 pkg:{manager}/{artifactId}@{version} 형식이다")
    void exportCycloneDx_bomRefWithoutGroupId() {
        // given
        DependencyComponent comp = buildComponent("npm", null, "lodash", "4.17.21");
        stubAccess(true);
        when(componentRepository.findBySession_Id(sessionId)).thenReturn(List.of(comp));
        when(cveSearchService.search(anyString(), any())).thenReturn(List.of());

        // when
        CycloneDxBom bom = service.exportCycloneDx(projectId, sessionId, userId);

        // then
        CycloneDxBom.Component component = bom.components().get(0);
        assertThat(component.bomRef()).isEqualTo("pkg:npm/lodash@4.17.21");
        assertThat(component.name()).isEqualTo("lodash");
    }

    // ─── CVE → vulnerabilities ───────────────────────────────────────────────

    @Test
    @DisplayName("CVE 매칭 결과가 vulnerabilities 배열에 포함된다")
    void exportCycloneDx_cveMatchesAreIncludedInVulnerabilities() {
        // given
        DependencyComponent comp = buildComponent("maven", null, "log4j", "2.14.1");
        CveSearchResponse cve = new CveSearchResponse(
                "CVE-2021-44228",
                "Log4Shell Remote Code Execution",
                new BigDecimal("10.0"),
                "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H",
                "CRITICAL"
        );

        stubAccess(true);
        when(componentRepository.findBySession_Id(sessionId)).thenReturn(List.of(comp));
        when(cveSearchService.search("log4j", null)).thenReturn(List.of(cve));

        // when
        CycloneDxBom bom = service.exportCycloneDx(projectId, sessionId, userId);

        // then
        assertThat(bom.vulnerabilities()).hasSize(1);
        CycloneDxBom.Vulnerability vuln = bom.vulnerabilities().get(0);
        assertThat(vuln.id()).isEqualTo("CVE-2021-44228");
        assertThat(vuln.description()).isEqualTo("Log4Shell Remote Code Execution");
        assertThat(vuln.affects()).hasSize(1);
        assertThat(vuln.affects().get(0).ref()).isEqualTo("pkg:maven/log4j@2.14.1");
    }

    @Test
    @DisplayName("CVE rating 에 CVSS 점수·심각도·벡터가 포함된다")
    void exportCycloneDx_cveRatingsContainCvssData() {
        // given
        DependencyComponent comp = buildComponent("npm", null, "axios", "1.6.2");
        CveSearchResponse cve = new CveSearchResponse(
                "CVE-2023-45857",
                "CSRF token exposure",
                new BigDecimal("6.5"),
                "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:N/A:N",
                "MEDIUM"
        );

        stubAccess(true);
        when(componentRepository.findBySession_Id(sessionId)).thenReturn(List.of(comp));
        when(cveSearchService.search("axios", null)).thenReturn(List.of(cve));

        // when
        CycloneDxBom bom = service.exportCycloneDx(projectId, sessionId, userId);

        // then
        CycloneDxBom.Vulnerability vuln = bom.vulnerabilities().get(0);
        assertThat(vuln.ratings()).hasSize(1);
        CycloneDxBom.Vulnerability.Rating rating = vuln.ratings().get(0);
        assertThat(rating.score()).isEqualByComparingTo(new BigDecimal("6.5"));
        assertThat(rating.severity()).isEqualTo("medium");
        assertThat(rating.vector()).isEqualTo("CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:N/A:N");
    }

    @Test
    @DisplayName("CVSS 점수가 없는 CVE 는 ratings 가 null 이다")
    void exportCycloneDx_cveWithoutCvssHasNullRatings() {
        // given
        DependencyComponent comp = buildComponent("npm", null, "some-lib", "1.0.0");
        CveSearchResponse cve = new CveSearchResponse(
                "CVE-2024-00001",
                "Some vulnerability",
                null,  // cvssScore 없음
                null,
                null
        );

        stubAccess(true);
        when(componentRepository.findBySession_Id(sessionId)).thenReturn(List.of(comp));
        when(cveSearchService.search("some-lib", null)).thenReturn(List.of(cve));

        // when
        CycloneDxBom bom = service.exportCycloneDx(projectId, sessionId, userId);

        // then
        CycloneDxBom.Vulnerability vuln = bom.vulnerabilities().get(0);
        assertThat(vuln.ratings()).isNull();
    }

    // ─── 접근 권한 검증 ───────────────────────────────────────────────────────

    @Test
    @DisplayName("프로젝트가 없으면 PROJECT_NOT_FOUND 예외가 발생한다")
    void exportCycloneDx_projectNotFound_throwsException() {
        // given
        when(projectRepository.findById(projectId)).thenReturn(Optional.empty());

        // when / then
        assertThatThrownBy(() -> service.exportCycloneDx(projectId, sessionId, userId))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.PROJECT_NOT_FOUND);

        verifyNoInteractions(componentRepository, cveSearchService);
    }

    @Test
    @DisplayName("팀 멤버가 아니면 PROJECT_ACCESS_DENIED 예외가 발생한다")
    void exportCycloneDx_notTeamMember_throwsException() {
        // given
        stubAccess(false);

        // when / then
        assertThatThrownBy(() -> service.exportCycloneDx(projectId, sessionId, userId))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.PROJECT_ACCESS_DENIED);

        verifyNoInteractions(componentRepository, cveSearchService);
    }

    // ─── CVE 검색 오류 내성 ───────────────────────────────────────────────────

    @Test
    @DisplayName("CVE 검색 중 예외가 발생하면 해당 컴포넌트를 건너뛰고 나머지를 처리한다")
    void exportCycloneDx_cveSearchException_doesNotFailEntireExport() {
        // given
        DependencyComponent comp = buildComponent("npm", null, "express", "4.18.0");
        stubAccess(true);
        when(componentRepository.findBySession_Id(sessionId)).thenReturn(List.of(comp));
        when(cveSearchService.search("express", null)).thenThrow(new RuntimeException("CVE service down"));

        // when — 예외가 전파되지 않고 빈 vulnerabilities 로 반환되어야 한다
        CycloneDxBom bom = service.exportCycloneDx(projectId, sessionId, userId);

        // then
        assertThat(bom.components()).hasSize(1);
        assertThat(bom.vulnerabilities()).isEmpty();
    }

    // ─── 헬퍼 ────────────────────────────────────────────────────────────────

    private void stubAccess(boolean isMember) {
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(teamMemberRepository.existsByProjectIdAndUserId(projectId, userId)).thenReturn(isMember);
    }

    private DependencyComponent buildComponent(
            String packageManager,
            String groupId,
            String artifactId,
            String version
    ) {
        return DependencyComponent.builder()
                .packageManager(packageManager)
                .groupId(groupId)
                .artifactId(artifactId)
                .version(version)
                .isDirect(true)
                .build();
    }
}
