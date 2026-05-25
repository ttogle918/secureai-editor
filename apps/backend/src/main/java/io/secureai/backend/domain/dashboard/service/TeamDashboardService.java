package io.secureai.backend.domain.dashboard.service;

import io.secureai.backend.domain.dashboard.dto.TeamDashboardResponse;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

/**
 * 팀(조직) 대시보드 집계 서비스.
 *
 * <p>도메인 격리 원칙: 크로스-도메인 데이터는 {@link JdbcTemplate} 읽기 전용 쿼리로만 접근한다.
 * JPA Repository 직접 주입 없음 (설계 원칙 — 도메인 간 Repository 직접 주입 금지 준수).
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TeamDashboardService {

    private final JdbcTemplate jdbcTemplate;

    /**
     * 팀 대시보드 데이터를 반환한다.
     *
     * @param teamId           조직 ID (팀 = 조직)
     * @param requestingUserId 요청자 ID (팀 멤버 검증용)
     * @return 팀 대시보드 응답
     * @throws BusinessException ORG_NOT_FOUND    — 조직이 없는 경우
     * @throws BusinessException ORG_ACCESS_DENIED — 팀원이 아닌 경우
     */
    public TeamDashboardResponse getTeamDashboard(UUID teamId, UUID requestingUserId) {
        String orgName = loadOrgNameOrThrow(teamId);
        verifyTeamMember(requestingUserId, teamId);

        List<UUID> memberIds = loadAcceptedMemberIds(teamId);
        if (memberIds.isEmpty()) {
            return buildEmptyResponse(teamId, orgName);
        }

        Map<UUID, UserStat> userMap      = loadUserStats(memberIds);
        Map<UUID, Long>     sessionMap   = loadSessionCounts(memberIds);
        double avgMttrHours              = loadAvgMttr(memberIds);
        long totalCritical               = countVulnsBySeverity(memberIds, "CRITICAL");
        long totalHigh                   = countVulnsBySeverity(memberIds, "HIGH");
        long monthlyTokenUsage           = loadMonthlyTokenUsage(memberIds);

        List<TeamDashboardResponse.MemberStat> members = buildMemberStats(memberIds, userMap, sessionMap);

        return new TeamDashboardResponse(teamId, orgName, members,
                totalCritical, totalHigh, avgMttrHours, monthlyTokenUsage);
    }

    // ── 조직 / 멤버 조회 ──────────────────────────────────────────────────────

    private String loadOrgNameOrThrow(UUID teamId) {
        try {
            return jdbcTemplate.queryForObject(
                    "SELECT name FROM organizations WHERE id = ? AND deleted_at IS NULL",
                    String.class, teamId);
        } catch (EmptyResultDataAccessException e) {
            throw new BusinessException(ErrorCode.ORG_NOT_FOUND);
        }
    }

    /**
     * 요청자가 수락된 팀 멤버인지 검증한다.
     *
     * @throws BusinessException ORG_ACCESS_DENIED — 팀원이 아닌 경우
     */
    void verifyTeamMember(UUID requestingUserId, UUID teamId) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM org_members WHERE org_id = ? AND user_id = ? AND accepted_at IS NOT NULL",
                Integer.class, teamId, requestingUserId);
        if (count == null || count == 0) {
            throw new BusinessException(ErrorCode.ORG_ACCESS_DENIED);
        }
    }

    private List<UUID> loadAcceptedMemberIds(UUID teamId) {
        return jdbcTemplate.query(
                "SELECT user_id FROM org_members WHERE org_id = ? AND accepted_at IS NOT NULL",
                (rs, row) -> rs.getObject("user_id", UUID.class),
                teamId);
    }

    // ── 데이터 로딩 헬퍼 (JdbcTemplate 전용) ─────────────────────────────────

    private Map<UUID, UserStat> loadUserStats(List<UUID> userIds) {
        if (userIds.isEmpty()) return Map.of();
        String sql = "SELECT id, username, security_score FROM users WHERE id IN ("
                + buildInClause(userIds.size()) + ")";
        // RowMapper 방식 — 반환된 List로 Map 구성 (ResultSetExtractor 클로저보다 mock 친화적)
        List<UserStat> stats = jdbcTemplate.query(sql,
                (rs, row) -> new UserStat(
                        rs.getObject("id", UUID.class),
                        rs.getString("username"),
                        rs.getInt("security_score")),
                userIds.toArray());
        Map<UUID, UserStat> map = new HashMap<>();
        stats.forEach(s -> map.put(s.id(), s));
        return map;
    }

    private Map<UUID, Long> loadSessionCounts(List<UUID> userIds) {
        if (userIds.isEmpty()) return Map.of();
        String sql = "SELECT user_id, COUNT(*) FROM analysis_sessions WHERE user_id IN ("
                + buildInClause(userIds.size()) + ") GROUP BY user_id";
        Map<UUID, Long> result = new HashMap<>();
        jdbcTemplate.query(sql, rs -> {
            result.put(rs.getObject("user_id", UUID.class), rs.getLong(2));
        }, userIds.toArray());
        return result;
    }

    private double loadAvgMttr(List<UUID> userIds) {
        if (userIds.isEmpty()) return 0.0;
        String sql = """
                SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) / 3600), 0)
                FROM analysis_sessions
                WHERE user_id IN (""" + buildInClause(userIds.size()) + """
                )
                  AND completed_at IS NOT NULL AND started_at IS NOT NULL
                """;
        Double result = jdbcTemplate.queryForObject(sql, Double.class, userIds.toArray());
        return result != null ? result : 0.0;
    }

    private long countVulnsBySeverity(List<UUID> userIds, String severity) {
        if (userIds.isEmpty()) return 0L;
        String sql = """
                SELECT COUNT(v.id)
                FROM vulnerabilities v
                JOIN analysis_sessions s ON s.id = v.session_id
                WHERE s.user_id IN (""" + buildInClause(userIds.size()) + """
                )
                  AND v.severity = ?
                """;
        Long count = jdbcTemplate.queryForObject(sql, Long.class, appendParam(userIds, severity));
        return count != null ? count : 0L;
    }

    private long loadMonthlyTokenUsage(List<UUID> userIds) {
        if (userIds.isEmpty()) return 0L;
        String sql = "SELECT COALESCE(SUM(sast_usage_this_month), 0) FROM users WHERE id IN ("
                + buildInClause(userIds.size()) + ")";
        Long total = jdbcTemplate.queryForObject(sql, Long.class, userIds.toArray());
        return total != null ? total : 0L;
    }

    // ── MemberStat 빌드 ──────────────────────────────────────────────────────

    private List<TeamDashboardResponse.MemberStat> buildMemberStats(
            List<UUID> memberIds, Map<UUID, UserStat> userMap, Map<UUID, Long> sessionMap) {

        List<TeamDashboardResponse.MemberStat> unsorted = new ArrayList<>();
        for (UUID userId : memberIds) {
            UserStat user = userMap.get(userId);
            if (user == null) {
                log.warn("팀 멤버 사용자 정보 없음 userId={}", userId);
                continue;
            }
            unsorted.add(new TeamDashboardResponse.MemberStat(
                    userId, user.username(), user.securityScore(),
                    sessionMap.getOrDefault(userId, 0L), 0));
        }

        unsorted.sort(Comparator.comparingInt(TeamDashboardResponse.MemberStat::securityScore).reversed());

        List<TeamDashboardResponse.MemberStat> ranked = new ArrayList<>();
        for (int i = 0; i < unsorted.size(); i++) {
            var s = unsorted.get(i);
            ranked.add(new TeamDashboardResponse.MemberStat(
                    s.userId(), s.username(), s.securityScore(), s.totalSessions(), i + 1));
        }
        return ranked;
    }

    private TeamDashboardResponse buildEmptyResponse(UUID teamId, String orgName) {
        return new TeamDashboardResponse(teamId, orgName, List.of(), 0L, 0L, 0.0, 0L);
    }

    // ── SQL 유틸 ─────────────────────────────────────────────────────────────

    /** SQL IN 절용 ? 플레이스홀더 생성 — SQL 인젝션 방지를 위해 파라미터 바인딩 사용. */
    private String buildInClause(int size) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < size; i++) {
            if (i > 0) sb.append(", ");
            sb.append("?");
        }
        return sb.toString();
    }

    /** userIds 뒤에 추가 파라미터를 붙인 Object[] 반환. */
    private Object[] appendParam(List<UUID> userIds, Object extra) {
        Object[] params = new Object[userIds.size() + 1];
        for (int i = 0; i < userIds.size(); i++) params[i] = userIds.get(i);
        params[userIds.size()] = extra;
        return params;
    }

    // ── 패키지-프라이빗 내부 집계 DTO (테스트에서 동일 패키지로 접근 가능) ─────

    /** 사용자 기본 통계 — 크로스-도메인 JDBC 집계 결과 컨테이너. */
    record UserStat(UUID id, String username, int securityScore) {}
}
