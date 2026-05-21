package io.secureai.backend.domain.report.controller;

import io.secureai.backend.domain.report.dto.ReportRequest;
import io.secureai.backend.domain.report.dto.ReportResponse;
import io.secureai.backend.domain.report.service.ReportService;
import io.secureai.backend.global.response.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ReportService reportService;

    /** 리포트 생성 요청 — 비동기로 처리되며 PENDING 상태로 즉시 응답 */
    @PostMapping
    public ResponseEntity<ApiResponse<ReportResponse>> requestReport(
            @AuthenticationPrincipal UUID userId,
            @Valid @RequestBody ReportRequest request) {
        ReportResponse response = reportService.requestGeneration(userId, request);
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(ApiResponse.success(response));
    }

    /** 리포트 생성 상태 조회 */
    @GetMapping("/{reportId}/status")
    public ResponseEntity<ApiResponse<ReportResponse>> getStatus(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID reportId) {
        return ResponseEntity.ok(ApiResponse.success(reportService.getStatus(userId, reportId)));
    }

    /**
     * 토큰으로 파일 다운로드.
     * 인증 불필요 — 다운로드 토큰 자체가 일회성 인증 수단.
     */
    @GetMapping("/download/{token}")
    public ResponseEntity<byte[]> download(@PathVariable String token) {
        ReportService.DownloadResult result = reportService.download(token);

        byte[] content;
        try {
            content = result.resource().getContentAsByteArray();
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType(result.contentType()));
        headers.setContentDisposition(
                ContentDisposition.attachment().filename(result.fileName()).build());
        headers.setContentLength(content.length);

        return ResponseEntity.ok().headers(headers).body(content);
    }

    /** 리포트 목록 조회 (프로젝트/세션 필터) */
    @GetMapping
    public ResponseEntity<ApiResponse<Page<ReportResponse>>> listReports(
            @AuthenticationPrincipal UUID userId,
            @RequestParam UUID projectId,
            @RequestParam(required = false) UUID sessionId,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(ApiResponse.success(
                reportService.listReports(userId, projectId, sessionId, pageable)));
    }
}
