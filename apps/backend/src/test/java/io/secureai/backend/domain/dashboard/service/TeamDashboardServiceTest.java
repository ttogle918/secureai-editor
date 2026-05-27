package io.secureai.backend.domain.dashboard.service;

import io.secureai.backend.domain.dashboard.dto.TeamDashboardResponse;
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
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ResultSetExtractor;
import org.springframework.jdbc.core.RowMapper;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * TeamDashboardService 단위 테스트.
 *
 * 모든 데이터 접근은 JdbcTemplate Mock을 통한다 (JPA Repository 없음).
 *
 * @MockitoSettings(LENIENT): 각 Nested 클래스에서 공통 스텁 일부가 미사용될 수 있어 LENIENT 설정.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("TeamDashboardService 단위 테스트")
class TeamDashboardServiceTest {

    @Mock JdbcTemplate jdbcTemplate;

    @InjectMocks TeamDashboardService teamDashboardService;

    private UUID teamId;
    private UUID requestingUserId;

    @BeforeEach
    void setUp() {
        teamId = UUID.randomUUID();
        requestingUserId = UUID.randomUUID();
    }

    // ── 정상 케이스 ───────────────────────────────────────────────────────────

    @Nested
    @DisplayName("getTeamDashboard — 정상 케이스")
    class SuccessCase {

        @Test
        @DisplayName("팀원이면 대시보드를 반환한다")
        void getTeamDashboard_팀원이면_대시보드반환() {
            // given
            stubOrg("Test Team");
            stubMemberCount(1);
            stubAcceptedMemberIds(List.of(requestingUserId));
            stubUserStats(new TeamDashboardService.UserStat(requestingUserId, "alice", 80));
            stubSessionCountNoop();
            stubMttr(2.5);
            stubSeverityCount(3L, 5L);
            stubMonthlyToken(100L);

            // when
            TeamDashboardResponse response = teamDashboardService.getTeamDashboard(teamId, requestingUserId);

            // then
            assertThat(response).isNotNull();
            assertThat(response.teamId()).isEqualTo(teamId);
            assertThat(response.teamName()).isEqualTo("Test Team");
            assertThat(response.members()).hasSize(1);
            assertThat(response.members().get(0).username()).isEqualTo("alice");
            assertThat(response.members().get(0).securityScore()).isEqualTo(80);
            assertThat(response.members().get(0).rank()).isEqualTo(1);
        }
    }

    // ── 접근 제어 ─────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("getTeamDashboard — 접근 제어")
    class AccessControlCase {

        @Test
        @DisplayName("비팀원이면 ORG_ACCESS_DENIED를 던진다")
        void getTeamDashboard_비팀원이면_FORBIDDEN() {
            stubOrg("Test Team");
            stubMemberCount(0);  // 멤버 아님

            assertThatThrownBy(() -> teamDashboardService.getTeamDashboard(teamId, requestingUserId))
                    .isInstanceOf(BusinessException.class)
                    .extracting(e -> ((BusinessException) e).getErrorCode())
                    .isEqualTo(ErrorCode.ORG_ACCESS_DENIED);
        }

        @Test
        @DisplayName("초대 수락 전(pending) 멤버는 ORG_ACCESS_DENIED를 던진다")
        void getTeamDashboard_수락전_팀원이면_FORBIDDEN() {
            // accepted_at IS NOT NULL 조건 → pending 멤버는 0 반환
            stubOrg("Test Team");
            stubMemberCount(0);

            assertThatThrownBy(() -> teamDashboardService.getTeamDashboard(teamId, requestingUserId))
                    .isInstanceOf(BusinessException.class)
                    .extracting(e -> ((BusinessException) e).getErrorCode())
                    .isEqualTo(ErrorCode.ORG_ACCESS_DENIED);
        }
    }

    // ── 빈 팀 edge case ───────────────────────────────────────────────────────

    @Nested
    @DisplayName("getTeamDashboard — 빈 팀 edge case")
    class EmptyTeamCase {

        @Test
        @DisplayName("수락된 팀원이 0명이면 빈 MemberStat 목록을 반환한다")
        void getTeamDashboard_빈팀_빈MemberStat_반환() {
            stubOrg("Empty Team");
            stubMemberCount(1);              // 요청자 자신은 멤버
            stubAcceptedMemberIds(List.of()); // 수락된 멤버 없음

            TeamDashboardResponse response = teamDashboardService.getTeamDashboard(teamId, requestingUserId);

            assertThat(response.members()).isEmpty();
            assertThat(response.teamName()).isEqualTo("Empty Team");
        }
    }

    // ── verifyTeamMember 단위 ─────────────────────────────────────────────────

    @Nested
    @DisplayName("verifyTeamMember — 단위 검증")
    class VerifyTeamMemberCase {

        @Test
        @DisplayName("수락된 멤버면 예외 없이 통과한다")
        void verifyTeamMember_수락된멤버_정상통과() {
            stubMemberCount(1);
            assertThatNoException()
                    .isThrownBy(() -> teamDashboardService.verifyTeamMember(requestingUserId, teamId));
        }

        @Test
        @DisplayName("비팀원이면 ORG_ACCESS_DENIED를 던진다")
        void verifyTeamMember_비팀원_FORBIDDEN() {
            stubMemberCount(0);
            assertThatThrownBy(() -> teamDashboardService.verifyTeamMember(requestingUserId, teamId))
                    .isInstanceOf(BusinessException.class)
                    .extracting(e -> ((BusinessException) e).getErrorCode())
                    .isEqualTo(ErrorCode.ORG_ACCESS_DENIED);
        }
    }

    // ── rank 정렬 검증 ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("getTeamDashboard — rank 정렬")
    class RankSortingTest {

        @Test
        @DisplayName("보안 점수 내림차순으로 rank가 부여된다")
        void getTeamDashboard_보안점수_내림차순_rank_부여() {
            // given
            UUID userId1 = UUID.randomUUID();  // charlie: 50
            UUID userId2 = UUID.randomUUID();  // bob:     90
            UUID userId3 = UUID.randomUUID();  // alice:   70

            stubOrg("Sorted Team");
            stubMemberCount(1);
            stubAcceptedMemberIds(List.of(userId1, userId2, userId3));
            stubUserStats(
                    new TeamDashboardService.UserStat(userId1, "charlie", 50),
                    new TeamDashboardService.UserStat(userId2, "bob",     90),
                    new TeamDashboardService.UserStat(userId3, "alice",   70)
            );
            stubSessionCountNoop();
            stubMttr(0.0);
            stubSeverityCount(0L, 0L);
            stubMonthlyToken(0L);

            // when
            TeamDashboardResponse response = teamDashboardService.getTeamDashboard(teamId, requestingUserId);

            // then — bob(90) rank=1, alice(70) rank=2, charlie(50) rank=3
            List<TeamDashboardResponse.MemberStat> stats = response.members();
            assertThat(stats).hasSize(3);
            assertThat(stats.get(0).username()).isEqualTo("bob");
            assertThat(stats.get(0).rank()).isEqualTo(1);
            assertThat(stats.get(1).username()).isEqualTo("alice");
            assertThat(stats.get(1).rank()).isEqualTo(2);
            assertThat(stats.get(2).username()).isEqualTo("charlie");
            assertThat(stats.get(2).rank()).isEqualTo(3);
        }
    }

    // ── 스텁 헬퍼 ────────────────────────────────────────────────────────────

    /** loadOrgNameOrThrow: organizations 테이블 조회 */
    private void stubOrg(String orgName) {
        when(jdbcTemplate.queryForObject(
                argThat(sql -> sql != null && sql.contains("organizations")),
                eq(String.class), eq(teamId))
        ).thenReturn(orgName);
    }

    /** verifyTeamMember: org_members COUNT 조회 */
    private void stubMemberCount(int count) {
        when(jdbcTemplate.queryForObject(
                argThat(sql -> sql != null && sql.contains("org_members") && sql.contains("COUNT")),
                eq(Integer.class), eq(teamId), eq(requestingUserId))
        ).thenReturn(count);
    }

    /** loadAcceptedMemberIds: org_members RowMapper 조회 */
    @SuppressWarnings("unchecked")
    private void stubAcceptedMemberIds(List<UUID> ids) {
        doReturn(ids).when(jdbcTemplate).query(
                argThat(sql -> sql != null && sql.contains("org_members")),
                any(RowMapper.class), eq(teamId));
    }

    /**
     * loadUserStats: users 테이블 RowMapper 조회.
     * TeamDashboardService.UserStat는 동일 패키지이므로 테스트에서 직접 참조 가능.
     */
    @SuppressWarnings("unchecked")
    private void stubUserStats(TeamDashboardService.UserStat... stats) {
        doReturn(List.of(stats)).when(jdbcTemplate).query(
                argThat(sql -> sql != null && sql.contains("username")),
                any(RowMapper.class), any(Object[].class));
    }

    /** loadSessionCounts: analysis_sessions ResultSetExtractor — 세션 수는 0으로 기본값 처리 */
    private void stubSessionCountNoop() {
        doAnswer(inv -> null).when(jdbcTemplate).query(
                argThat(sql -> sql != null && sql.contains("analysis_sessions") && sql.contains("GROUP BY")),
                any(ResultSetExtractor.class), any(Object[].class));
    }

    /** loadAvgMttr: EXTRACT 포함 SQL */
    private void stubMttr(double value) {
        when(jdbcTemplate.queryForObject(
                argThat(sql -> sql != null && sql.contains("EXTRACT")),
                eq(Double.class), any(Object[].class))
        ).thenReturn(value);
    }

    /**
     * countVulnsBySeverity: severity 포함 SQL — 연속 호출(critical, high)에 대해 순서대로 반환.
     */
    private void stubSeverityCount(long critical, long high) {
        when(jdbcTemplate.queryForObject(
                argThat(sql -> sql != null && sql.contains("severity")),
                eq(Long.class), any(Object[].class))
        ).thenReturn(critical, high);
    }

    /** loadMonthlyTokenUsage: sast_usage_this_month 포함 SQL */
    private void stubMonthlyToken(long total) {
        when(jdbcTemplate.queryForObject(
                argThat(sql -> sql != null && sql.contains("sast_usage_this_month")),
                eq(Long.class), any(Object[].class))
        ).thenReturn(total);
    }
}
