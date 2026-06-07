package io.secureai.backend.domain.organization.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OrgAnalyticsServiceTest {

    @Mock JdbcTemplate jdbcTemplate;

    private OrgAnalyticsService service;
    private final UUID orgId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new OrgAnalyticsService(jdbcTemplate);
    }

    @Test
    @DisplayName("countSessionsByOrgMembers — 집계 결과를 반환한다")
    void countSessions_returnsCount() {
        when(jdbcTemplate.queryForObject(anyString(), eq(Long.class), eq(orgId))).thenReturn(12L);
        assertThat(service.countSessionsByOrgMembers(orgId)).isEqualTo(12L);
    }

    @Test
    @DisplayName("countVulnsByOrgMembers — 집계 결과를 반환한다")
    void countVulns_returnsCount() {
        when(jdbcTemplate.queryForObject(anyString(), eq(Long.class), eq(orgId))).thenReturn(7L);
        assertThat(service.countVulnsByOrgMembers(orgId)).isEqualTo(7L);
    }

    @Test
    @DisplayName("countProjectsByOrgMembers — 집계 결과를 반환한다")
    void countProjects_returnsCount() {
        when(jdbcTemplate.queryForObject(anyString(), eq(Long.class), eq(orgId))).thenReturn(3L);
        assertThat(service.countProjectsByOrgMembers(orgId)).isEqualTo(3L);
    }

    @Test
    @DisplayName("null 집계 결과는 0 으로 변환한다")
    void nullResult_coercedToZero() {
        when(jdbcTemplate.queryForObject(anyString(), eq(Long.class), eq(orgId))).thenReturn(null);
        assertThat(service.countSessionsByOrgMembers(orgId)).isZero();
        assertThat(service.countVulnsByOrgMembers(orgId)).isZero();
        assertThat(service.countProjectsByOrgMembers(orgId)).isZero();
    }
}
