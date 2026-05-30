package io.secureai.backend.domain.dashboard.service;

import io.secureai.backend.domain.analysis.service.VulnerabilityQueryService;
import io.secureai.backend.domain.dashboard.dto.DashboardResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DashboardCacheServiceTest {

    @Mock
    private VulnerabilityQueryService vulnerabilityQueryService;

    @InjectMocks
    private DashboardCacheService service;

    private final UUID projectId = UUID.randomUUID();

    // ── calculateSecurityScore ───────────────────────────────────────────────

    @Test
    @DisplayName("calculateSecurityScore — 100 - C×20 - H×10 - M×3 - L×1 (INFO는 무시)")
    void calculateSecurityScore_appliesWeightedPenalty() {
        var counts = new DashboardResponse.SeverityCounts(1, 1, 1, 1, 999);
        // 100 - 20 - 10 - 3 - 1 = 66
        assertThat(service.calculateSecurityScore(counts)).isEqualTo(66);
    }

    @Test
    @DisplayName("calculateSecurityScore — 취약점이 없으면 만점 100")
    void calculateSecurityScore_noVulns_isPerfect() {
        var counts = new DashboardResponse.SeverityCounts(0, 0, 0, 0, 0);
        assertThat(service.calculateSecurityScore(counts)).isEqualTo(100);
    }

    @Test
    @DisplayName("calculateSecurityScore — 패널티가 100을 넘어도 0으로 하한 클램프")
    void calculateSecurityScore_clampsAtZero() {
        var counts = new DashboardResponse.SeverityCounts(10, 0, 0, 0, 0); // 패널티 200
        assertThat(service.calculateSecurityScore(counts)).isZero();
    }

    // ── fillMissingDates ─────────────────────────────────────────────────────

    @Test
    @DisplayName("fillMissingDates — 누락된 날짜를 0으로 채우고 양 끝을 포함한다")
    void fillMissingDates_fillsGapsWithZero() {
        LocalDate from = LocalDate.of(2026, 1, 1);
        LocalDate to   = LocalDate.of(2026, 1, 3);
        Map<String, Long> db = new LinkedHashMap<>();
        db.put("2026-01-02", 5L);

        List<DashboardResponse.TrendPoint> trend = service.fillMissingDates(from, to, db);

        assertThat(trend).extracting(DashboardResponse.TrendPoint::date)
                .containsExactly("2026-01-01", "2026-01-02", "2026-01-03");
        assertThat(trend).extracting(DashboardResponse.TrendPoint::count)
                .containsExactly(0L, 5L, 0L);
    }

    // ── buildOwaspCoverage ───────────────────────────────────────────────────

    @Test
    @DisplayName("buildOwaspCoverage — 접두사 매칭으로 10개 카테고리 커버리지를 산출한다")
    void buildOwaspCoverage_prefixMatches() {
        // 리포지토리 쿼리가 owasp IS NOT NULL로 걸러주므로 입력에 null은 없다고 가정한다
        when(vulnerabilityQueryService.findOwaspCategoriesForProject(projectId))
                .thenReturn(List.of("A03:2021-Injection", "A01-Broken"));

        Map<String, Boolean> coverage = service.buildOwaspCoverage(projectId);

        assertThat(coverage).hasSize(10);
        assertThat(coverage.get("A01")).isTrue();
        assertThat(coverage.get("A03")).isTrue();
        assertThat(coverage.get("A02")).isFalse();
        assertThat(coverage.get("A10")).isFalse();
    }

    @Test
    @DisplayName("buildOwaspCoverage — 매칭되는 취약점이 없으면 모든 카테고리가 false")
    void buildOwaspCoverage_noMatches_allFalse() {
        when(vulnerabilityQueryService.findOwaspCategoriesForProject(projectId))
                .thenReturn(List.of());

        Map<String, Boolean> coverage = service.buildOwaspCoverage(projectId);

        assertThat(coverage).hasSize(10);
        assertThat(coverage.values()).containsOnly(false);
    }

    // ── getAggregated (오케스트레이션) ─────────────────────────────────────────

    @Test
    @DisplayName("getAggregated — 5개 집계를 조립해 DashboardResponse를 구성한다")
    void getAggregated_assemblesResponse() {
        when(vulnerabilityQueryService.countBySeverityForProject(projectId))
                .thenReturn(List.of(
                        new Object[]{"CRITICAL", 2L},
                        new Object[]{"HIGH", 1L}));
        when(vulnerabilityQueryService.countDailyForProject(eq(projectId), any(LocalDate.class)))
                .thenReturn(List.of());
        when(vulnerabilityQueryService.findTopFilesForProject(projectId, 10))
                .thenReturn(List.<Object[]>of(new Object[]{"src/A.java", 3L}));
        when(vulnerabilityQueryService.findOwaspCategoriesForProject(projectId))
                .thenReturn(List.of("A03:2021-Injection"));

        DashboardResponse response = service.getAggregated(projectId);

        // 심각도 매핑: 누락된 등급은 0
        assertThat(response.severityCounts().critical()).isEqualTo(2);
        assertThat(response.severityCounts().high()).isEqualTo(1);
        assertThat(response.severityCounts().medium()).isZero();
        // 점수: 100 - 2×20 - 1×10 = 50
        assertThat(response.securityScore()).isEqualTo(50);
        // 추이는 항상 연속된 7일
        assertThat(response.trend()).hasSize(7);
        assertThat(response.trend()).allSatisfy(p -> assertThat(p.count()).isZero());
        // 히트맵
        assertThat(response.fileHeatmap()).singleElement()
                .satisfies(h -> {
                    assertThat(h.filePath()).isEqualTo("src/A.java");
                    assertThat(h.count()).isEqualTo(3);
                });
        // OWASP 커버리지
        assertThat(response.owaspCoverage()).hasSize(10);
        assertThat(response.owaspCoverage().get("A03")).isTrue();
        assertThat(response.owaspCoverage().get("A01")).isFalse();
    }
}
