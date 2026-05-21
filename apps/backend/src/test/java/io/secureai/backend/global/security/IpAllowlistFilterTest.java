package io.secureai.backend.global.security;

import io.secureai.backend.domain.team.entity.TeamSettings;
import io.secureai.backend.domain.team.repository.TeamSettingsRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class IpAllowlistFilterTest {

    @Mock
    private TeamSettingsRepository teamSettingsRepository;

    @InjectMocks
    private IpAllowlistFilter filter;

    @Mock
    private FilterChain filterChain;

    private MockHttpServletRequest request;
    private MockHttpServletResponse response;

    @BeforeEach
    void setUp() {
        request = new MockHttpServletRequest();
        response = new MockHttpServletResponse();
    }

    // ─── isIpAllowed 단위 테스트 ─────────────────────────────────────

    @Test
    @DisplayName("허용 목록이 비어있으면 모든 IP를 허용한다")
    void isIpAllowed_emptyList_returnsTrue() {
        assertThat(filter.isIpAllowed("192.168.1.100", List.of())).isTrue();
    }

    @Test
    @DisplayName("CIDR 범위 내 IP는 허용된다")
    void isIpAllowed_ipInCidrRange_returnsTrue() {
        List<String> ranges = List.of("192.168.1.0/24");
        assertThat(filter.isIpAllowed("192.168.1.100", ranges)).isTrue();
    }

    @Test
    @DisplayName("CIDR 범위 외 IP는 거부된다")
    void isIpAllowed_ipOutsideCidrRange_returnsFalse() {
        List<String> ranges = List.of("192.168.1.0/24");
        assertThat(filter.isIpAllowed("10.0.0.1", ranges)).isFalse();
    }

    @Test
    @DisplayName("단일 IP (/32)와 정확히 일치하는 IP는 허용된다")
    void isIpAllowed_exactIp32_returnsTrue() {
        List<String> ranges = List.of("10.0.0.1/32");
        assertThat(filter.isIpAllowed("10.0.0.1", ranges)).isTrue();
    }

    @Test
    @DisplayName("단일 IP (/32)와 다른 IP는 거부된다")
    void isIpAllowed_differentIpWith32Prefix_returnsFalse() {
        List<String> ranges = List.of("10.0.0.1/32");
        assertThat(filter.isIpAllowed("10.0.0.2", ranges)).isFalse();
    }

    @Test
    @DisplayName("/0 은 모든 IP를 허용한다")
    void isIpAllowed_prefixZero_allowsAll() {
        List<String> ranges = List.of("0.0.0.0/0");
        assertThat(filter.isIpAllowed("203.0.113.42", ranges)).isTrue();
    }

    @Test
    @DisplayName("CIDR 서브넷 경계값 — 첫 번째 주소가 허용된다")
    void isIpAllowed_subnetFirstAddress_returnsTrue() {
        // 192.168.10.0/24 — 첫 번째 호스트 주소 포함
        List<String> ranges = List.of("192.168.10.0/24");
        assertThat(filter.isIpAllowed("192.168.10.1", ranges)).isTrue();
    }

    @Test
    @DisplayName("잘못된 CIDR 항목은 무시하고 나머지 범위로 판단한다")
    void isIpAllowed_invalidCidrSkipped_usesRemainingRanges() {
        List<String> ranges = List.of("NOT_A_CIDR", "10.0.0.0/8");
        // 잘못된 항목은 skip — 10.0.0.0/8에 포함된 주소는 허용
        assertThat(filter.isIpAllowed("10.1.2.3", ranges)).isTrue();
    }

    @Test
    @DisplayName("잘못된 CIDR만 있고 해당 IP가 그 외 범위에도 없으면 거부된다")
    void isIpAllowed_onlyInvalidCidr_returnsFalse() {
        List<String> ranges = List.of("NOT_A_CIDR");
        assertThat(filter.isIpAllowed("10.0.0.1", ranges)).isFalse();
    }

    // ─── doFilterInternal 통합 흐름 테스트 ──────────────────────────

    @Test
    @DisplayName("허용 목록이 비어있으면 필터를 통과한다")
    void doFilterInternal_noSettings_passesThrough() throws Exception {
        when(teamSettingsRepository.findAll()).thenReturn(List.of());
        request.setRemoteAddr("203.0.113.42");

        filter.doFilterInternal(request, response, filterChain);

        verify(filterChain).doFilter(request, response);
        assertThat(response.getStatus()).isEqualTo(200);
    }

    @Test
    @DisplayName("허용된 IP이면 필터를 통과한다")
    void doFilterInternal_allowedIp_passesThrough() throws Exception {
        TeamSettings settings = TeamSettings.builder()
                .teamId(UUID.randomUUID())
                .allowedIpRanges(List.of("192.168.1.0/24"))
                .build();
        when(teamSettingsRepository.findAll()).thenReturn(List.of(settings));
        request.setRemoteAddr("192.168.1.50");

        filter.doFilterInternal(request, response, filterChain);

        verify(filterChain).doFilter(request, response);
    }

    @Test
    @DisplayName("허용되지 않은 IP이면 403을 반환하고 필터 체인을 중단한다")
    void doFilterInternal_blockedIp_returns403() throws Exception {
        TeamSettings settings = TeamSettings.builder()
                .teamId(UUID.randomUUID())
                .allowedIpRanges(List.of("192.168.1.0/24"))
                .build();
        when(teamSettingsRepository.findAll()).thenReturn(List.of(settings));
        request.setRemoteAddr("10.0.0.1");

        filter.doFilterInternal(request, response, filterChain);

        verify(filterChain, never()).doFilter(any(), any());
        assertThat(response.getStatus()).isEqualTo(403);
        assertThat(response.getContentAsString()).contains("IP_BLOCKED");
    }

    @Test
    @DisplayName("여러 팀 설정이 있을 때 하나라도 허용하면 통과한다")
    void doFilterInternal_multipleTeams_allowedByOne_passesThrough() throws Exception {
        TeamSettings ts1 = TeamSettings.builder()
                .teamId(UUID.randomUUID())
                .allowedIpRanges(List.of("10.0.0.0/8"))
                .build();
        TeamSettings ts2 = TeamSettings.builder()
                .teamId(UUID.randomUUID())
                .allowedIpRanges(List.of("172.16.0.0/12"))
                .build();
        when(teamSettingsRepository.findAll()).thenReturn(List.of(ts1, ts2));
        request.setRemoteAddr("172.16.5.10");

        filter.doFilterInternal(request, response, filterChain);

        verify(filterChain).doFilter(request, response);
    }
}
