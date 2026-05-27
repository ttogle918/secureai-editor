package io.secureai.backend.domain.compliance.dto;

import java.util.List;

/**
 * 컴플라이언스 프레임워크 매핑 결과 응답.
 */
public record ComplianceResponse(
        String framework,              // "ISO27001" | "NIST_CSF"
        List<ControlResult> controls
) {
    /**
     * 컨트롤 항목별 준수 여부.
     */
    public record ControlResult(
            String controlId,          // ISO: "A.9.4.1"  /  NIST: "PR.AC-4"
            String controlName,        // 컨트롤 이름
            String owaspCategory,      // "A01 Broken Access Control" 등
            boolean compliant,         // 해당 OWASP 카테고리 취약점 0건이면 true
            int vulnerabilityCount
    ) {}
}
