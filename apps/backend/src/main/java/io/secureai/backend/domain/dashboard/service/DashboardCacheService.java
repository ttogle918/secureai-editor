package io.secureai.backend.domain.dashboard.service;

import io.secureai.backend.domain.analysis.service.VulnerabilityQueryService;
import io.secureai.backend.domain.dashboard.dto.DashboardResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * 대시보드 Redis 캐시 + 집계 전용 서비스.
 * {@link DashboardQueryService} 내부에서 @Cacheable을 직접 호출하면
 * Spring AOP self-invocation 문제로 캐시가 적용되지 않는다.
 * 집계 로직과 캐싱을 이 Bean에 집중시켜 프록시가 정상 동작하도록 한다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DashboardCacheService {

    private static final int HEATMAP_LIMIT      = 10;
    private static final int TREND_DAYS         = 7;
    private static final int SCORE_MAX          = 100;
    private static final int SCORE_PER_CRITICAL = 20;
    private static final int SCORE_PER_HIGH     = 10;
    private static final int SCORE_PER_MEDIUM   = 3;
    private static final int SCORE_PER_LOW      = 1;

    private static final List<String> OWASP_CATEGORIES = List.of(
            "A01", "A02", "A03", "A04", "A05",
            "A06", "A07", "A08", "A09", "A10"
    );

    private final VulnerabilityQueryService vulnerabilityQueryService;

    /**
     * 프로젝트 집계 결과를 Redis에 5분 TTL로 캐시해 반환한다.
     * 권한 검증은 호출자({@link DashboardQueryService#getDashboard})가 책임진다.
     *
     * @param projectId 대상 프로젝트 ID
     * @return 캐시된 대시보드 집계 응답
     */
    @Cacheable(value = "dashboard", key = "#projectId")
    public DashboardResponse getAggregated(UUID projectId) {
        log.debug("대시보드 집계 시작 — projectId={}", projectId);

        DashboardResponse.SeverityCounts severityCounts = buildSeverityCounts(projectId);
        int securityScore = calculateSecurityScore(severityCounts);
        List<DashboardResponse.TrendPoint> trend = buildTrend(projectId);
        List<DashboardResponse.FileHeatPoint> fileHeatmap = buildFileHeatmap(projectId);
        Map<String, Boolean> owaspCoverage = buildOwaspCoverage(projectId);

        return new DashboardResponse(
                securityScore,
                severityCounts,
                trend,
                fileHeatmap,
                owaspCoverage
        );
    }

    // ── 심각도별 건수 집계 ────────────────────────────────────────────────────

    private DashboardResponse.SeverityCounts buildSeverityCounts(UUID projectId) {
        Map<String, Long> countMap = new LinkedHashMap<>();
        for (Object[] row : vulnerabilityQueryService.countBySeverityForProject(projectId)) {
            countMap.put((String) row[0], (Long) row[1]);
        }
        return new DashboardResponse.SeverityCounts(
                countMap.getOrDefault("CRITICAL", 0L),
                countMap.getOrDefault("HIGH",     0L),
                countMap.getOrDefault("MEDIUM",   0L),
                countMap.getOrDefault("LOW",      0L),
                countMap.getOrDefault("INFO",     0L)
        );
    }

    // ── 보안 점수 계산 ────────────────────────────────────────────────────────

    /**
     * securityScore = max(0, 100 - CRITICAL×20 - HIGH×10 - MEDIUM×3 - LOW×1)
     */
    int calculateSecurityScore(DashboardResponse.SeverityCounts counts) {
        long penalty = counts.critical() * SCORE_PER_CRITICAL
                + counts.high()     * SCORE_PER_HIGH
                + counts.medium()   * SCORE_PER_MEDIUM
                + counts.low()      * SCORE_PER_LOW;
        return (int) Math.max(0, SCORE_MAX - penalty);
    }

    // ── 최근 7일 일별 추이 ────────────────────────────────────────────────────

    private List<DashboardResponse.TrendPoint> buildTrend(UUID projectId) {
        LocalDate today = LocalDate.now();
        LocalDate from  = today.minusDays(TREND_DAYS - 1);

        Map<String, Long> dbResult = new LinkedHashMap<>();
        for (Object[] row : vulnerabilityQueryService.countDailyForProject(projectId, from)) {
            dbResult.put(row[0].toString(), (Long) row[1]);
        }
        return fillMissingDates(from, today, dbResult);
    }

    /**
     * DB 결과에 없는 날짜를 count=0으로 채워 연속된 7일 목록을 반환한다.
     */
    List<DashboardResponse.TrendPoint> fillMissingDates(
            LocalDate from, LocalDate to, Map<String, Long> dbResult) {
        List<DashboardResponse.TrendPoint> trend = new ArrayList<>();
        for (LocalDate date = from; !date.isAfter(to); date = date.plusDays(1)) {
            String key = date.toString();
            trend.add(new DashboardResponse.TrendPoint(key, dbResult.getOrDefault(key, 0L)));
        }
        return trend;
    }

    // ── 파일별 히트맵 ─────────────────────────────────────────────────────────

    private List<DashboardResponse.FileHeatPoint> buildFileHeatmap(UUID projectId) {
        List<DashboardResponse.FileHeatPoint> heatmap = new ArrayList<>();
        for (Object[] row : vulnerabilityQueryService.findTopFilesForProject(
                projectId, HEATMAP_LIMIT)) {
            heatmap.add(new DashboardResponse.FileHeatPoint((String) row[0], (Long) row[1]));
        }
        return heatmap;
    }

    // ── OWASP Top 10 커버리지 ─────────────────────────────────────────────────

    Map<String, Boolean> buildOwaspCoverage(UUID projectId) {
        Set<String> present = Set.copyOf(
                vulnerabilityQueryService.findOwaspCategoriesForProject(projectId));

        Map<String, Boolean> coverage = new LinkedHashMap<>();
        for (String category : OWASP_CATEGORIES) {
            boolean found = present.stream()
                    .anyMatch(v -> v != null && v.startsWith(category));
            coverage.put(category, found);
        }
        return coverage;
    }
}
