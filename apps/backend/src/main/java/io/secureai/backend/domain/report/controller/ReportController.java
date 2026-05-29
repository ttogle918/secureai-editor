package io.secureai.backend.domain.report.controller;

import io.secureai.backend.domain.report.dto.ReportRequest;
import io.secureai.backend.domain.report.dto.ReportResponse;
import io.secureai.backend.domain.report.service.ReportService;
import io.secureai.backend.domain.report.service.RoiCalculationService;
import io.secureai.backend.domain.report.service.RoiCalculationService.RoiResult;
import io.secureai.backend.domain.report.service.SecurityDocAsyncProcessor;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import io.secureai.backend.global.response.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.UUID;
import java.util.concurrent.ExecutionException;

@Slf4j
@RestController
@RequestMapping("/api/v1/reports")
@RequiredArgsConstructor
public class ReportController {

    private static final Path ROI_PDF_BASE_DIR =
            Paths.get(System.getProperty("java.io.tmpdir"), "secureai", "security-docs")
                    .toAbsolutePath().normalize();

    private final ReportService reportService;
    private final RoiCalculationService roiCalculationService;
    private final SecurityDocAsyncProcessor securityDocAsyncProcessor;

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

    /** 완료된 리포트를 사용자 본인 이메일로 전송 (다운로드 링크 + PDF 첨부) */
    @PostMapping("/{reportId}/send-email")
    public ResponseEntity<ApiResponse<Void>> sendEmail(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID reportId) {
        reportService.sendEmail(userId, reportId);
        return ResponseEntity.ok(ApiResponse.success(null));
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

    /**
     * 세션의 ROI(투자 대비 절감 효과)를 JSON으로 반환한다.
     * 입력 검증: hourlyRate는 Controller 레이어에서만 수행.
     *
     * @param projectId  프로젝트 ID (경로 변수)
     * @param sessionId  분석 세션 ID (경로 변수)
     * @param hourlyRate 시간당 단가, 기본값 50.0
     */
    @GetMapping("/projects/{projectId}/sessions/{sessionId}/roi")
    public ResponseEntity<ApiResponse<RoiResult>> getRoiResult(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID projectId,
            @PathVariable UUID sessionId,
            @RequestParam(defaultValue = "50.0") double hourlyRate) {

        if (hourlyRate < 0) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "hourlyRate는 0 이상이어야 합니다.");
        }

        RoiResult result = roiCalculationService.calculateRoi(sessionId, hourlyRate);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    /**
     * 세션 ROI 리포트를 PDF로 다운로드한다.
     * PDF 생성은 동기(blocking)로 처리 — 다운로드 요청이므로 즉시 반환 필요.
     *
     * @param projectId  프로젝트 ID (경로 변수)
     * @param sessionId  분석 세션 ID (경로 변수)
     * @param hourlyRate 시간당 단가, 기본값 50.0
     */
    @GetMapping("/projects/{projectId}/sessions/{sessionId}/roi/pdf")
    public ResponseEntity<byte[]> downloadRoiPdf(
            @AuthenticationPrincipal UUID userId,
            @PathVariable UUID projectId,
            @PathVariable UUID sessionId,
            @RequestParam(defaultValue = "50.0") double hourlyRate) {

        if (hourlyRate < 0) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "hourlyRate는 0 이상이어야 합니다.");
        }

        try {
            String filePath = securityDocAsyncProcessor
                    .processRoiReport(sessionId, hourlyRate)
                    .get();

            Path path = Paths.get(filePath).toAbsolutePath().normalize();
            // 보안: 허용 디렉토리 외 경로 접근 차단 (Path Traversal 방어)
            if (!path.startsWith(ROI_PDF_BASE_DIR)) {
                log.warn("[ReportController] 허용되지 않은 ROI PDF 경로 sessionId={}", sessionId);
                throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR, "파일을 읽을 수 없습니다.");
            }

            byte[] content = Files.readAllBytes(path);
            String fileName = "roi-report-" + sessionId + ".pdf";

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_PDF);
            headers.setContentDisposition(
                    ContentDisposition.attachment().filename(fileName).build());
            headers.setContentLength(content.length);

            return ResponseEntity.ok().headers(headers).body(content);

        } catch (BusinessException e) {
            throw e;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.error("[ReportController] ROI PDF 생성 인터럽트 sessionId={}", sessionId, e);
            throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR, "PDF 생성이 중단되었습니다.");
        } catch (ExecutionException e) {
            log.error("[ReportController] ROI PDF 생성 실패 sessionId={}", sessionId, e.getCause());
            throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR, "PDF 생성에 실패했습니다.");
        } catch (Exception e) {
            log.error("[ReportController] ROI PDF 다운로드 오류 sessionId={}", sessionId, e);
            throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR, "PDF를 읽을 수 없습니다.");
        }
    }
}
