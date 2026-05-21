package io.secureai.backend.domain.report.controller;

import io.secureai.backend.domain.report.dto.SecurityDocResponse;
import io.secureai.backend.domain.report.entity.DocType;
import io.secureai.backend.domain.report.service.SecurityDocService;
import io.secureai.backend.global.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class SecurityDocController {

    private final SecurityDocService securityDocService;

    /**
     * 보안 문서 생성 요청 — 비동기로 처리되며 PENDING 상태로 즉시 응답.
     * POST /api/v1/projects/{projectId}/reports/security?type=CISO|HANAFOS|ISMS
     */
    @PostMapping("/api/v1/projects/{projectId}/reports/security")
    public ResponseEntity<ApiResponse<SecurityDocResponse>> createSecurityDoc(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID projectId,
            @RequestParam String type) {

        DocType docType = parseDocType(type);
        SecurityDocResponse response = securityDocService.createRequest(projectId, userId, docType);
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(ApiResponse.success(response));
    }

    /**
     * 보안 문서 생성 상태 조회.
     * GET /api/v1/projects/{projectId}/reports/security/{requestId}
     */
    @GetMapping("/api/v1/projects/{projectId}/reports/security/{requestId}")
    public ResponseEntity<ApiResponse<SecurityDocResponse>> getStatus(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID projectId,
            @PathVariable UUID requestId) {

        SecurityDocResponse response = securityDocService.getStatus(requestId, userId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    /**
     * 토큰으로 PDF 다운로드 — 인증 불필요 (다운로드 토큰이 일회성 인증 수단).
     * GET /api/v1/reports/security/download?token={token}
     */
    @GetMapping("/api/v1/reports/security/download")
    public ResponseEntity<byte[]> download(@RequestParam String token) {
        SecurityDocService.DownloadResult result = securityDocService.download(token);

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

    private DocType parseDocType(String type) {
        try {
            return DocType.valueOf(type.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new io.secureai.backend.global.exception.BusinessException(
                    io.secureai.backend.global.exception.ErrorCode.INVALID_INPUT,
                    "지원하지 않는 문서 유형입니다. CISO, HANAFOS, ISMS 중 선택하세요.");
        }
    }
}
