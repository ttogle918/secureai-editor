package io.secureai.backend.domain.sbom.service;

import io.secureai.backend.domain.cve.dto.CveSearchResponse;
import io.secureai.backend.domain.cve.service.CveSearchService;
import io.secureai.backend.domain.project.repository.ProjectRepository;
import io.secureai.backend.domain.project.repository.TeamMemberRepository;
import io.secureai.backend.domain.sbom.dto.CycloneDxBom;
import io.secureai.backend.domain.sbom.dto.CycloneDxBom.Component;
import io.secureai.backend.domain.sbom.dto.CycloneDxBom.Vulnerability;
import io.secureai.backend.domain.sbom.dto.CycloneDxBom.Vulnerability.Affect;
import io.secureai.backend.domain.sbom.dto.CycloneDxBom.Vulnerability.Rating;
import io.secureai.backend.domain.sbom.entity.DependencyComponent;
import io.secureai.backend.domain.sbom.repository.DependencyComponentRepository;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * CycloneDX 1.4 포맷으로 SBOM 내보내기를 담당한다.
 *
 * <p>SbomService 와 책임을 분리(SRP)하여 내보내기 로직만 보유한다.
 * CVE 도메인 Repository 직접 주입 금지 — CveSearchService 를 통해서만 접근한다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CycloneDxExportService {

    private static final String BOM_FORMAT    = "CycloneDX";
    private static final String SPEC_VERSION  = "1.4";
    private static final int    BOM_VERSION   = 1;
    private static final String COMPONENT_TYPE = "library";

    private final DependencyComponentRepository componentRepository;
    private final ProjectRepository             projectRepository;
    private final TeamMemberRepository          teamMemberRepository;
    // cve 도메인 Repository 직접 주입 금지 — Service를 통해 접근 (도메인 격리 원칙)
    private final CveSearchService              cveSearchService;

    /**
     * 특정 프로젝트·세션의 SBOM 컴포넌트를 CycloneDX 1.4 BOM 포맷으로 반환한다.
     *
     * <p>프로젝트 팀 멤버 여부를 검증한 후, 세션에 속한 컴포넌트를 조회하고
     * CVE 매칭 결과를 선택적으로 포함하여 BOM 을 구성한다.
     *
     * @param projectId 프로젝트 ID
     * @param sessionId 분석 세션 ID
     * @param userId    요청자 ID (@AuthenticationPrincipal에서 획득)
     * @return CycloneDX 1.4 BOM
     */
    @Transactional(readOnly = true)
    public CycloneDxBom exportCycloneDx(UUID projectId, UUID sessionId, UUID userId) {
        verifyProjectAccess(projectId, userId);

        List<DependencyComponent> dbComponents = componentRepository.findBySession_Id(sessionId);
        log.info("[cyclonedx] 내보내기 시작 projectId={} sessionId={} componentCount={}",
                projectId, sessionId, dbComponents.size());

        List<Component> components = buildComponents(dbComponents);
        List<Vulnerability> vulnerabilities = buildVulnerabilities(dbComponents, components);

        String serialNumber = "urn:uuid:" + UUID.randomUUID();

        return new CycloneDxBom(
                BOM_FORMAT,
                SPEC_VERSION,
                serialNumber,
                BOM_VERSION,
                components,
                vulnerabilities
        );
    }

    private List<Component> buildComponents(List<DependencyComponent> dbComponents) {
        return dbComponents.stream()
                .map(this::toComponent)
                .toList();
    }

    private Component toComponent(DependencyComponent comp) {
        String bomRef = buildBomRef(comp);
        String displayName = comp.getGroupId() != null
                ? comp.getGroupId() + ":" + comp.getArtifactId()
                : comp.getArtifactId();

        return new Component(COMPONENT_TYPE, bomRef, displayName, comp.getVersion());
    }

    /**
     * purl(Package URL) 스펙 기반 bom-ref 를 생성한다.
     * 형식: pkg:{packageManager}/{groupId}:{artifactId}@{version}
     */
    private String buildBomRef(DependencyComponent comp) {
        StringBuilder ref = new StringBuilder("pkg:");
        ref.append(comp.getPackageManager()).append("/");

        if (comp.getGroupId() != null) {
            ref.append(comp.getGroupId()).append(":");
        }
        ref.append(comp.getArtifactId());

        if (comp.getVersion() != null) {
            ref.append("@").append(comp.getVersion());
        }
        return ref.toString();
    }

    /**
     * 각 컴포넌트의 artifactId 로 CVE 검색 후 Vulnerability 목록을 구성한다.
     *
     * <p>개별 CVE 검색 실패 시 전체 내보내기를 중단하지 않고 경고 로그 후 건너뛴다.
     */
    private List<Vulnerability> buildVulnerabilities(
            List<DependencyComponent> dbComponents,
            List<Component> components
    ) {
        List<Vulnerability> vulnerabilities = new ArrayList<>();

        for (int i = 0; i < dbComponents.size(); i++) {
            DependencyComponent dbComp = dbComponents.get(i);
            String bomRef = components.get(i).bomRef();

            try {
                List<CveSearchResponse> cves = cveSearchService.search(dbComp.getArtifactId(), null);
                for (CveSearchResponse cve : cves) {
                    vulnerabilities.add(toVulnerability(cve, bomRef));
                }
            } catch (Exception e) {
                log.warn("[cyclonedx] CVE 검색 실패 artifact={} error={}", dbComp.getArtifactId(), e.getMessage());
            }
        }
        return vulnerabilities;
    }

    private Vulnerability toVulnerability(CveSearchResponse cve, String bomRef) {
        List<Rating> ratings = buildRatings(cve);
        List<Affect> affects = List.of(new Affect(bomRef));

        return new Vulnerability(
                cve.cveId(),
                cve.description(),
                ratings.isEmpty() ? null : ratings,
                affects
        );
    }

    private List<Rating> buildRatings(CveSearchResponse cve) {
        if (cve.cvssScore() == null) {
            return List.of();
        }
        return List.of(new Rating(
                cve.cvssScore(),
                cve.severity() != null ? cve.severity().toLowerCase() : "unknown",
                cve.cvssVector()
        ));
    }

    private void verifyProjectAccess(UUID projectId, UUID userId) {
        projectRepository.findById(projectId)
                .orElseThrow(() -> new BusinessException(ErrorCode.PROJECT_NOT_FOUND));
        if (!teamMemberRepository.existsByProjectIdAndUserId(projectId, userId)) {
            throw new BusinessException(ErrorCode.PROJECT_ACCESS_DENIED);
        }
    }
}
