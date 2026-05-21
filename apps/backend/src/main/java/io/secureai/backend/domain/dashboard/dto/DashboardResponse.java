package io.secureai.backend.domain.dashboard.dto;

import java.util.List;
import java.util.Map;

/**
 * 대시보드 집계 응답 DTO.
 * 5개의 차트 데이터를 단일 엔드포인트로 반환한다.
 */
public record DashboardResponse(
        int securityScore,
        SeverityCounts severityCounts,
        List<TrendPoint> trend,
        List<FileHeatPoint> fileHeatmap,
        Map<String, Boolean> owaspCoverage
) {

    /** 심각도별 취약점 건수 */
    public record SeverityCounts(
            long critical,
            long high,
            long medium,
            long low,
            long info
    ) {}

    /** 일별 취약점 발생 추이 */
    public record TrendPoint(String date, long count) {}

    /** 파일별 취약점 집중도 */
    public record FileHeatPoint(String filePath, long count) {}
}
