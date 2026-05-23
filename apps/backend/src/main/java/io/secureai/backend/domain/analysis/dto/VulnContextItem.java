package io.secureai.backend.domain.analysis.dto;

/**
 * AI Engine 컨텍스트 조회용 취약점 유형 집계 단위.
 * GET /api/v1/internal/projects/{projectId}/vuln-context 응답 항목.
 *
 * @param vulnType    취약점 유형 (SQL_INJECTION 등)
 * @param count       최근 30일 발생 횟수
 * @param maxSeverity 최근 30일 최고 심각도
 */
public record VulnContextItem(
        String vulnType,
        long count,
        String maxSeverity
) {}
