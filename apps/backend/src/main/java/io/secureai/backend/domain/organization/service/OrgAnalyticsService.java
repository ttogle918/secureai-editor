package io.secureai.backend.domain.organization.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * 조직 단위 사용량 통계 집계 서비스.
 * analysis/project 도메인 테이블을 직접 조회하지만, 읽기 전용 집계 쿼리만 수행하며
 * 파라미터 바인딩을 통해 SQL 인젝션을 방지한다.
 */
@Service
@RequiredArgsConstructor
public class OrgAnalyticsService {

    private final JdbcTemplate jdbcTemplate;

    @Transactional(readOnly = true)
    public long countSessionsByOrgMembers(UUID orgId) {
        String sql = """
                SELECT COUNT(s.id)
                FROM analysis_sessions s
                WHERE s.user_id IN (
                    SELECT user_id FROM org_members
                    WHERE org_id = ? AND accepted_at IS NOT NULL
                )
                """;
        Long count = jdbcTemplate.queryForObject(sql, Long.class, orgId);
        return count != null ? count : 0L;
    }

    @Transactional(readOnly = true)
    public long countVulnsByOrgMembers(UUID orgId) {
        String sql = """
                SELECT COUNT(v.id)
                FROM vulnerabilities v
                JOIN analysis_sessions s ON s.id = v.session_id
                WHERE s.user_id IN (
                    SELECT user_id FROM org_members
                    WHERE org_id = ? AND accepted_at IS NOT NULL
                )
                """;
        Long count = jdbcTemplate.queryForObject(sql, Long.class, orgId);
        return count != null ? count : 0L;
    }

    @Transactional(readOnly = true)
    public long countProjectsByOrgMembers(UUID orgId) {
        String sql = """
                SELECT COUNT(DISTINCT p.id)
                FROM projects p
                WHERE p.org_id = ?
                  AND p.deleted_at IS NULL
                """;
        Long count = jdbcTemplate.queryForObject(sql, Long.class, orgId);
        return count != null ? count : 0L;
    }
}
