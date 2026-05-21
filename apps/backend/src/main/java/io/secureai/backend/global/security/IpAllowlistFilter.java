package io.secureai.backend.global.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.secureai.backend.domain.team.repository.TeamSettingsRepository;
import io.secureai.backend.global.exception.ErrorCode;
import io.secureai.backend.global.response.ApiResponse;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.nio.ByteBuffer;
import java.util.List;

/**
 * CIDR 기반 IP 허용 목록 필터.
 *
 * 팀 설정에 allowed_ip_ranges가 비어 있으면 모든 IP를 허용한다 (fail-open 정책).
 * 설정된 경우 요청 IP가 하나 이상의 CIDR 범위에 속해야 통과한다.
 *
 * 보안 주의:
 * - request.getRemoteAddr() 를 사용한다 (application.yaml forward-headers-strategy: NATIVE 적용 시
 *   Spring이 X-Forwarded-For를 신뢰 가능한 프록시에서만 수용하여 이미 올바른 IP로 변환).
 * - X-Forwarded-For 헤더를 직접 읽지 않는다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class IpAllowlistFilter extends OncePerRequestFilter {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final TeamSettingsRepository teamSettingsRepository;

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {

        // 모든 팀 설정을 합산한 허용 범위를 구한다.
        // 설정이 전혀 없거나 모든 팀의 목록이 비어있으면 pass-through.
        List<String> allAllowedRanges = teamSettingsRepository.findAll()
                .stream()
                .flatMap(ts -> ts.getAllowedIpRanges().stream())
                .toList();

        if (allAllowedRanges.isEmpty()) {
            filterChain.doFilter(request, response);
            return;
        }

        String clientIp = request.getRemoteAddr();

        if (!isIpAllowed(clientIp, allAllowedRanges)) {
            log.warn("IP 허용 목록 차단: remoteAddr={}", clientIp);
            sendForbidden(response);
            return;
        }

        filterChain.doFilter(request, response);
    }

    /**
     * 클라이언트 IP가 허용 CIDR 범위 목록 중 하나에 속하는지 확인한다.
     * 목록이 비어있으면 모든 IP를 허용한다 (fail-open 정책).
     */
    boolean isIpAllowed(String clientIp, List<String> allowedRanges) {
        if (allowedRanges.isEmpty()) {
            return true;
        }
        for (String cidr : allowedRanges) {
            try {
                if (isInCidrRange(clientIp, cidr)) {
                    return true;
                }
            } catch (Exception e) {
                // 잘못된 CIDR 항목은 로그를 남기고 skip (개별 항목 오류가 전체를 막지 않음)
                log.warn("CIDR 범위 체크 실패 (항목 무시): cidr={}, error={}", cidr, e.getMessage());
            }
        }
        return false;
    }

    /**
     * 순수 Java 비트 연산으로 CIDR 포함 여부를 판단한다.
     * IPv4, IPv6 모두 지원한다.
     */
    private boolean isInCidrRange(String clientIp, String cidr) throws UnknownHostException {
        String[] parts = cidr.split("/");
        if (parts.length != 2) {
            throw new IllegalArgumentException("올바르지 않은 CIDR 형식: " + cidr);
        }

        InetAddress network = InetAddress.getByName(parts[0]);
        int prefixLength = Integer.parseInt(parts[1].trim());
        InetAddress client = InetAddress.getByName(clientIp);

        byte[] networkBytes = network.getAddress();
        byte[] clientBytes = client.getAddress();

        // 주소 패밀리(IPv4 vs IPv6)가 다르면 false
        if (networkBytes.length != clientBytes.length) {
            return false;
        }

        // 비트 마스크 적용: prefixLength 이후 비트는 무시
        int fullBytes = prefixLength / 8;
        int remainingBits = prefixLength % 8;

        for (int i = 0; i < fullBytes; i++) {
            if (networkBytes[i] != clientBytes[i]) {
                return false;
            }
        }

        if (remainingBits > 0 && fullBytes < networkBytes.length) {
            int mask = 0xFF & (0xFF << (8 - remainingBits));
            if ((networkBytes[fullBytes] & mask) != (clientBytes[fullBytes] & mask)) {
                return false;
            }
        }

        return true;
    }

    private void sendForbidden(HttpServletResponse response) throws IOException {
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        ErrorCode code = ErrorCode.IP_BLOCKED;
        ApiResponse<Void> body = ApiResponse.error(code.name(), code.getMessage(), null);
        response.getWriter().write(MAPPER.writeValueAsString(body));
    }
}
