package io.secureai.backend.domain.sbom.dto;

import io.secureai.backend.domain.sbom.entity.DependencyComponent;

import java.util.List;
import java.util.UUID;

/**
 * SBOM 컴포넌트 조회 응답 DTO.
 *
 * GET /api/v1/projects/{projectId}/sbom/components
 */
public record SbomComponentResponse(
        UUID id,
        String name,
        String version,
        String ecosystem,
        String license,
        List<String> cveIds,
        boolean isDirect
) {
    /**
     * DependencyComponent 엔티티를 응답 DTO로 변환한다.
     *
     * <p>cveIds는 현재 DependencyComponent 엔티티에 직접 저장하지 않으므로
     * 빈 리스트로 반환한다. 추후 CVE 매핑 테이블 연동 시 확장 예정.
     */
    public static SbomComponentResponse from(DependencyComponent c) {
        String displayName = c.getGroupId() != null
                ? c.getGroupId() + ":" + c.getArtifactId()
                : c.getArtifactId();

        return new SbomComponentResponse(
                c.getId(),
                displayName,
                c.getVersion(),
                c.getPackageManager(),
                // license는 현재 엔티티에 없으므로 null 반환 (추후 확장)
                null,
                List.of(),
                Boolean.TRUE.equals(c.getIsDirect())
        );
    }
}
