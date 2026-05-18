package io.secureai.backend.domain.dashboard.service;

import io.secureai.backend.domain.analysis.service.VulnerabilityQueryService;
import io.secureai.backend.domain.dashboard.dto.DashboardResponse;
import io.secureai.backend.domain.project.entity.Project;
import io.secureai.backend.domain.project.service.ProjectService;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DashboardQueryServiceTest {

    // ─── DashboardQueryService 권한 검증 테스트 ───────────────────────────────

    @Nested
    @DisplayName("DashboardQueryService — 접근 권한 검증")
    class AccessValidationTest {

        @Mock ProjectService projectService;
        @Mock DashboardCacheService dashboardCacheService;

        @InjectMocks DashboardQueryService dashboardQueryService;

        private UUID userId;
        private UUID projectId;

        @BeforeEach
        void setUp() {
            userId    = UUID.randomUUID();
            projectId = UUID.randomUUID();
        }

        @Test
        @DisplayName("존재하지 않는 프로젝트 → PROJECT_NOT_FOUND")
        void getDashboard_projectNotFound_throwsProjectNotFound() {
            when(projectService.findOrThrow(projectId))
                    .thenThrow(new BusinessException(ErrorCode.PROJECT_NOT_FOUND));

            assertThatThrownBy(() -> dashboardQueryService.getDashboard(userId, projectId))
                    .isInstanceOf(BusinessException.class)
                    .extracting(e -> ((BusinessException) e).getErrorCode())
                    .isEqualTo(ErrorCode.PROJECT_NOT_FOUND);
        }

        @Test
        @DisplayName("멤버가 아닌 사용자 → PROJECT_ACCESS_DENIED")
        void getDashboard_notMember_throwsAccessDenied() {
            when(projectService.findOrThrow(projectId)).thenReturn(mock(Project.class));
            when(projectService.isMember(projectId, userId)).thenReturn(false);

            assertThatThrownBy(() -> dashboardQueryService.getDashboard(userId, projectId))
                    .isInstanceOf(BusinessException.class)
                    .extracting(e -> ((BusinessException) e).getErrorCode())
                    .isEqualTo(ErrorCode.PROJECT_ACCESS_DENIED);
        }

        @Test
        @DisplayName("권한 검증 통과 후 DashboardCacheService에 위임한다")
        void getDashboard_validAccess_delegatesToCacheService() {
            DashboardResponse fakeResponse = new DashboardResponse(
                    100,
                    new DashboardResponse.SeverityCounts(0, 0, 0, 0, 0),
                    List.of(),
                    List.of(),
                    Map.of()
            );
            when(projectService.findOrThrow(projectId)).thenReturn(mock(Project.class));
            when(projectService.isMember(projectId, userId)).thenReturn(true);
            when(dashboardCacheService.getAggregated(projectId)).thenReturn(fakeResponse);

            DashboardResponse result = dashboardQueryService.getDashboard(userId, projectId);

            assertThat(result).isEqualTo(fakeResponse);
            verify(dashboardCacheService).getAggregated(projectId);
        }
    }

    // ─── DashboardCacheService 집계 로직 테스트 ──────────────────────────────

    @Nested
    @DisplayName("DashboardCacheService — 집계 로직")
    class AggregationTest {

        @Mock VulnerabilityQueryService vulnerabilityQueryService;

        @InjectMocks DashboardCacheService dashboardCacheService;

        private UUID projectId;

        @BeforeEach
        void setUp() {
            projectId = UUID.randomUUID();
        }

        // ── securityScore 계산 ─────────────────────────────────────────────────

        @Nested
        @DisplayName("calculateSecurityScore")
        class CalculateSecurityScoreTest {

            @Test
            @DisplayName("취약점이 없으면 100점이다")
            void noVulnerabilities_returns100() {
                DashboardResponse.SeverityCounts counts =
                        new DashboardResponse.SeverityCounts(0, 0, 0, 0, 0);

                int score = dashboardCacheService.calculateSecurityScore(counts);

                assertThat(score).isEqualTo(100);
            }

            @Test
            @DisplayName("CRITICAL 5개이면 100 - 100 = 0점이다")
            void critical5_returns0() {
                DashboardResponse.SeverityCounts counts =
                        new DashboardResponse.SeverityCounts(5, 0, 0, 0, 0);

                int score = dashboardCacheService.calculateSecurityScore(counts);

                assertThat(score).isEqualTo(0);
            }

            @Test
            @DisplayName("점수는 0 미만으로 내려가지 않는다")
            void penaltyExceedsMax_clampsToZero() {
                DashboardResponse.SeverityCounts counts =
                        new DashboardResponse.SeverityCounts(10, 0, 0, 0, 0);

                int score = dashboardCacheService.calculateSecurityScore(counts);

                assertThat(score).isEqualTo(0);
            }

            @Test
            @DisplayName("복합 심각도 계산: CRITICAL×20 + HIGH×10 + MEDIUM×3 + LOW×1")
            void mixedSeverity_calculatesCorrectly() {
                // 100 - (1×20) - (1×10) - (1×3) - (1×1) = 66
                DashboardResponse.SeverityCounts lightCounts =
                        new DashboardResponse.SeverityCounts(1, 1, 1, 1, 0);
                assertThat(dashboardCacheService.calculateSecurityScore(lightCounts)).isEqualTo(66);

                // 100 - (2×20) - (5×10) - (10×3) - (3×1) = -23 → 0
                DashboardResponse.SeverityCounts heavyCounts =
                        new DashboardResponse.SeverityCounts(2, 5, 10, 3, 1);
                assertThat(dashboardCacheService.calculateSecurityScore(heavyCounts)).isEqualTo(0);
            }

            @Test
            @DisplayName("INFO는 점수에 영향을 주지 않는다")
            void infoOnly_noScorePenalty() {
                DashboardResponse.SeverityCounts counts =
                        new DashboardResponse.SeverityCounts(0, 0, 0, 0, 99);

                int score = dashboardCacheService.calculateSecurityScore(counts);

                assertThat(score).isEqualTo(100);
            }
        }

        // ── trend 빈 날짜 채우기 ───────────────────────────────────────────────

        @Nested
        @DisplayName("fillMissingDates")
        class FillMissingDatesTest {

            @Test
            @DisplayName("DB 결과가 없는 날짜는 count=0으로 채워진다")
            void missingDates_filledWithZero() {
                LocalDate from = LocalDate.of(2026, 5, 11);
                LocalDate to   = LocalDate.of(2026, 5, 17);
                Map<String, Long> dbResult = Map.of(
                        "2026-05-13", 3L,
                        "2026-05-15", 5L
                );

                List<DashboardResponse.TrendPoint> trend =
                        dashboardCacheService.fillMissingDates(from, to, dbResult);

                assertThat(trend).hasSize(7);
                assertThat(trend.get(0)).isEqualTo(new DashboardResponse.TrendPoint("2026-05-11", 0L));
                assertThat(trend.get(2)).isEqualTo(new DashboardResponse.TrendPoint("2026-05-13", 3L));
                assertThat(trend.get(4)).isEqualTo(new DashboardResponse.TrendPoint("2026-05-15", 5L));
                assertThat(trend.get(6)).isEqualTo(new DashboardResponse.TrendPoint("2026-05-17", 0L));
            }

            @Test
            @DisplayName("DB 결과가 전혀 없으면 7일 모두 count=0이다")
            void emptyDbResult_allZero() {
                LocalDate from = LocalDate.of(2026, 5, 11);
                LocalDate to   = LocalDate.of(2026, 5, 17);

                List<DashboardResponse.TrendPoint> trend =
                        dashboardCacheService.fillMissingDates(from, to, Map.of());

                assertThat(trend).hasSize(7);
                assertThat(trend).allMatch(p -> p.count() == 0L);
            }

            @Test
            @DisplayName("7일 모두 데이터가 있으면 DB 값 그대로 반환된다")
            void allDatesPresent_returnsDbValues() {
                LocalDate from = LocalDate.of(2026, 5, 11);
                LocalDate to   = LocalDate.of(2026, 5, 17);
                Map<String, Long> dbResult = Map.of(
                        "2026-05-11", 1L, "2026-05-12", 2L, "2026-05-13", 3L,
                        "2026-05-14", 4L, "2026-05-15", 5L, "2026-05-16", 6L,
                        "2026-05-17", 7L
                );

                List<DashboardResponse.TrendPoint> trend =
                        dashboardCacheService.fillMissingDates(from, to, dbResult);

                assertThat(trend).hasSize(7);
                long sum = trend.stream().mapToLong(DashboardResponse.TrendPoint::count).sum();
                assertThat(sum).isEqualTo(28L);
            }
        }

        // ── OWASP Coverage A01~A10 매핑 ────────────────────────────────────────

        @Nested
        @DisplayName("buildOwaspCoverage")
        class BuildOwaspCoverageTest {

            @Test
            @DisplayName("A01~A10 키가 모두 포함된다")
            void coverage_containsAllKeys() {
                when(vulnerabilityQueryService.findOwaspCategoriesForProject(projectId))
                        .thenReturn(List.of());

                Map<String, Boolean> coverage =
                        dashboardCacheService.buildOwaspCoverage(projectId);

                assertThat(coverage).containsKeys(
                        "A01", "A02", "A03", "A04", "A05",
                        "A06", "A07", "A08", "A09", "A10"
                );
            }

            @Test
            @DisplayName("해당 카테고리 취약점이 있으면 true, 없으면 false이다")
            void coverage_trueForPresentCategories() {
                when(vulnerabilityQueryService.findOwaspCategoriesForProject(projectId))
                        .thenReturn(List.of("A01", "A03", "A07"));

                Map<String, Boolean> coverage =
                        dashboardCacheService.buildOwaspCoverage(projectId);

                assertThat(coverage.get("A01")).isTrue();
                assertThat(coverage.get("A03")).isTrue();
                assertThat(coverage.get("A07")).isTrue();
                assertThat(coverage.get("A02")).isFalse();
                assertThat(coverage.get("A04")).isFalse();
                assertThat(coverage.get("A10")).isFalse();
            }

            @Test
            @DisplayName("owasp 값이 'A01:2021-...' 형태여도 prefix 매칭으로 인식된다")
            void coverage_prefixMatching() {
                when(vulnerabilityQueryService.findOwaspCategoriesForProject(projectId))
                        .thenReturn(List.of("A01:2021-Broken Access Control", "A03:2021-Injection"));

                Map<String, Boolean> coverage =
                        dashboardCacheService.buildOwaspCoverage(projectId);

                assertThat(coverage.get("A01")).isTrue();
                assertThat(coverage.get("A03")).isTrue();
                assertThat(coverage.get("A02")).isFalse();
            }

            @Test
            @DisplayName("취약점이 전혀 없으면 A01~A10 모두 false이다")
            void noVulnerabilities_allFalse() {
                when(vulnerabilityQueryService.findOwaspCategoriesForProject(projectId))
                        .thenReturn(List.of());

                Map<String, Boolean> coverage =
                        dashboardCacheService.buildOwaspCoverage(projectId);

                assertThat(coverage.values()).allMatch(v -> !v);
            }
        }

        // ── getAggregated 통합 흐름 ────────────────────────────────────────────

        @Test
        @DisplayName("getAggregated — 정상 조회 시 DashboardResponse가 반환된다")
        void getAggregated_success_returnsDashboardResponse() {
            List<Object[]> severityCounts = new java.util.ArrayList<>();
            severityCounts.add(new Object[]{"CRITICAL", 1L});
            severityCounts.add(new Object[]{"HIGH", 2L});
            when(vulnerabilityQueryService.countBySeverityForProject(projectId))
                    .thenReturn(severityCounts);
            when(vulnerabilityQueryService.countDailyForProject(eq(projectId), any()))
                    .thenReturn(List.of());
            List<Object[]> topFiles = new java.util.ArrayList<>();
            topFiles.add(new Object[]{"src/Foo.java", 5L});
            when(vulnerabilityQueryService.findTopFilesForProject(eq(projectId), anyInt()))
                    .thenReturn(topFiles);
            when(vulnerabilityQueryService.findOwaspCategoriesForProject(projectId))
                    .thenReturn(List.of("A01"));

            DashboardResponse response = dashboardCacheService.getAggregated(projectId);

            assertThat(response).isNotNull();
            assertThat(response.severityCounts().critical()).isEqualTo(1L);
            assertThat(response.severityCounts().high()).isEqualTo(2L);
            // score: 100 - 1×20 - 2×10 = 60
            assertThat(response.securityScore()).isEqualTo(60);
            assertThat(response.trend()).hasSize(7);
            assertThat(response.fileHeatmap()).hasSize(1);
            assertThat(response.owaspCoverage().get("A01")).isTrue();
            assertThat(response.owaspCoverage().get("A02")).isFalse();
        }
    }
}
