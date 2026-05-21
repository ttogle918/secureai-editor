package io.secureai.backend.domain.team.dto;

import jakarta.validation.constraints.NotNull;

import java.util.List;

/**
 * IP 허용 목록 업데이트 요청 DTO.
 * allowedIpRanges: CIDR 형식 목록 (빈 목록이면 모든 IP 허용)
 */
public record IpAllowlistRequest(
        @NotNull(message = "allowedIpRanges 필드는 필수입니다.")
        List<String> allowedIpRanges
) {}
