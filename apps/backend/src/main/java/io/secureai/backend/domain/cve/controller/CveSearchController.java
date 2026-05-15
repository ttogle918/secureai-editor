package io.secureai.backend.domain.cve.controller;

import io.secureai.backend.domain.cve.dto.CveSearchResponse;
import io.secureai.backend.domain.cve.service.CveSearchService;
import io.secureai.backend.global.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * CVE 검색 API.
 *
 * AI Engine → Backend 내부 호출 전용 (X-Internal-Key 인증).
 * 사용자 직접 호출은 Security 설정에서 차단한다.
 */
@RestController
@RequiredArgsConstructor
public class CveSearchController {

    private final CveSearchService cveSearchService;

    /**
     * 패키지 이름으로 CVE 목록을 검색한다.
     *
     * GET /api/v1/cve/search?packageName={name}&version={version}
     *
     * @param packageName 검색할 패키지 이름 (필수)
     * @param version     버전 문자열 (선택, 현재 미사용)
     */
    @GetMapping("/api/v1/cve/search")
    public ResponseEntity<ApiResponse<Map<String, List<CveSearchResponse>>>> search(
            @RequestParam String packageName,
            @RequestParam(required = false) String version) {
        List<CveSearchResponse> cves = cveSearchService.search(packageName, version);
        return ResponseEntity.ok(ApiResponse.success(Map.of("cves", cves)));
    }
}
