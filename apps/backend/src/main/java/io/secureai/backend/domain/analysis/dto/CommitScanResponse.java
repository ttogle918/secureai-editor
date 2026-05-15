package io.secureai.backend.domain.analysis.dto;

import java.util.UUID;

/**
 * 커밋 시크릿 스캔 응답 DTO.
 *
 * - triggerScan: AI Engine 호출 결과 (accepted / error)
 * - secretCount: 현재 세션에 저장된 SECRET_EXPOSURE 유형 취약점 수
 */
public record CommitScanResponse(
        UUID sessionId,
        String status,
        int secretCount
) {}
