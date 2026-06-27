package io.secureai.backend.domain.report.controller;

import io.secureai.backend.domain.report.entity.ComplianceFramework;
import io.secureai.backend.domain.report.entity.DocType;
import io.secureai.backend.domain.report.service.ComplianceService;
import io.secureai.backend.global.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequiredArgsConstructor
public class ComplianceFrameworkController {

    private final ComplianceService complianceService;

    @GetMapping("/api/v1/compliance/frameworks")
    public ResponseEntity<ApiResponse<List<FrameworkDto>>> getFrameworks(@RequestParam String type) {
        DocType docType = DocType.valueOf(type.toUpperCase());
        List<ComplianceFramework> frameworks = complianceService.getActiveFrameworks(docType);
        
        List<FrameworkDto> dtos = frameworks.stream().map(f -> new FrameworkDto(
            f.getId().toString(), f.getName(), f.getVersion(), f.getDescription(), f.getOfficialLink(), f.getFormLink()
        )).collect(Collectors.toList());

        return ResponseEntity.ok(ApiResponse.success(dtos));
    }

    public record FrameworkDto(String id, String name, String version, String description, String officialLink, String formLink) {}
}
