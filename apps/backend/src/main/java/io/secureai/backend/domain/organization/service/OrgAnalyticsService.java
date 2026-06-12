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

    /**
     * 조직 멤버들이 사용한 총 크레딧을 credit_transactions 테이블에서 집계한다.
     * delta가 음수(차감)인 행만 합산하여 소비량으로 계산한다.
     * 파라미터 바인딩으로 SQL 인젝션 방지.
     *
     * @param orgId 조직 UUID
     * @return 총 소비 크레딧 (양수 값, 0 이상)
     */
    @Transactional(readOnly = true)
    public long sumCreditsByOrgMembers(UUID orgId) {
        String sql = """
                SELECT COALESCE(SUM(ABS(ct.delta)), 0)
                FROM credit_transactions ct
                WHERE ct.delta < 0
                  AND ct.user_id IN (
                    SELECT user_id FROM org_members
                    WHERE org_id = ? AND accepted_at IS NOT NULL
                  )
                """;
        Long sum = jdbcTemplate.queryForObject(sql, Long.class, orgId);
        return sum != null ? sum : 0L;
    }
}
