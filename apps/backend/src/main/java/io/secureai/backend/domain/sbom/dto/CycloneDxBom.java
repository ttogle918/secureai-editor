package io.secureai.backend.domain.sbom.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;
import java.util.List;

/**
 * CycloneDX 1.4 BOM 응답 DTO.
 *
 * <p>GET /api/v1/projects/{projectId}/sbom/cyclonedx 엔드포인트 응답에 사용된다.
 * null 값은 직렬화에서 제외한다.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record CycloneDxBom(
        String bomFormat,
        String specVersion,
        String serialNumber,
        int version,
        List<Component> components,
        List<Vulnerability> vulnerabilities
) {

    /**
     * CycloneDX 컴포넌트 항목.
     *
     * <p>CycloneDX 스펙의 "bom-ref" 필드는 JSON 키에 하이픈이 포함되므로
     * {@link JsonProperty}로 직렬화 키를 명시한다.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Component(
            String type,
            @JsonProperty("bom-ref") String bomRef,
            String name,
            String version
    ) {}

    /**
     * CycloneDX 취약점 항목.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Vulnerability(
            String id,
            String description,
            List<Rating> ratings,
            List<Affect> affects
    ) {
        @JsonInclude(JsonInclude.Include.NON_NULL)
        public record Rating(
                BigDecimal score,
                String severity,
                String vector
        ) {}

        @JsonInclude(JsonInclude.Include.NON_NULL)
        public record Affect(String ref) {}
    }
}
