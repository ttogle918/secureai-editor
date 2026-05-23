package io.secureai.backend.domain.team.service;

import io.secureai.backend.domain.team.entity.TeamSettings;
import io.secureai.backend.domain.team.repository.TeamSettingsRepository;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.InetAddress;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class TeamSettingsService {

    private final TeamSettingsRepository teamSettingsRepository;

    /**
     * 팀의 IP 허용 목록을 업데이트한다 (upsert 방식).
     * 설정이 없으면 새로 생성, 있으면 업데이트한다.
     *
     * @param teamId    팀 ID (users.id)
     * @param ipRanges  CIDR 형식 IP 범위 목록 (빈 목록 허용 — 모든 IP 허용)
     */
    @Transactional
    public void updateIpAllowlist(UUID teamId, List<String> ipRanges) {
        validateCidrList(ipRanges);

        TeamSettings settings = teamSettingsRepository.findByTeamId(teamId)
                .orElseGet(() -> TeamSettings.builder()
                        .teamId(teamId)
                        .build());

        settings.setAllowedIpRanges(ipRanges);
        teamSettingsRepository.save(settings);
        log.info("IP 허용 목록 업데이트 완료: teamId={}, rangeCount={}", teamId, ipRanges.size());
    }

    /**
     * 각 CIDR 항목의 형식을 검증한다.
     */
    private void validateCidrList(List<String> ranges) {
        if (ranges == null) {
            return;
        }
        for (String cidr : ranges) {
            validateCidr(cidr);
        }
    }

    private void validateCidr(String cidr) {
        if (cidr == null || cidr.isBlank()) {
            throw new BusinessException(ErrorCode.INVALID_CIDR_FORMAT, "CIDR 값이 비어있습니다.");
        }

        String[] parts = cidr.split("/");
        if (parts.length != 2) {
            throw new BusinessException(ErrorCode.INVALID_CIDR_FORMAT, "올바른 CIDR 형식이 아닙니다: " + cidr);
        }

        String ipPart = parts[0];
        String prefixPart = parts[1];

        try {
            InetAddress.getByName(ipPart);
        } catch (Exception e) {
            throw new BusinessException(ErrorCode.INVALID_CIDR_FORMAT, "유효하지 않은 IP 주소: " + ipPart);
        }

        try {
            int prefix = Integer.parseInt(prefixPart.trim());
            boolean isIpv6 = ipPart.contains(":");
            int maxPrefix = isIpv6 ? 128 : 32;
            if (prefix < 0 || prefix > maxPrefix) {
                throw new BusinessException(ErrorCode.INVALID_CIDR_FORMAT,
                        "프리픽스 길이가 범위를 벗어났습니다 (0-" + maxPrefix + "): " + prefix);
            }
        } catch (NumberFormatException e) {
            throw new BusinessException(ErrorCode.INVALID_CIDR_FORMAT, "프리픽스 길이가 숫자가 아닙니다: " + prefixPart);
        }
    }
}
