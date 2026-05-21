package io.secureai.backend.domain.team.entity;

import io.secureai.backend.global.converter.StringListConverter;
import io.secureai.backend.global.entity.BaseTimeEntity;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * 팀(사용자)별 보안 설정 — IP 허용 목록을 포함한다.
 * allowed_ip_ranges: CIDR 형식 목록 (예: "192.168.1.0/24", "10.0.0.1/32")
 * 목록이 비어있으면 모든 IP를 허용한다 (fail-open 정책).
 */
@Entity
@Table(name = "team_settings")
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class TeamSettings extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "team_id", nullable = false, unique = true)
    private UUID teamId;

    @Convert(converter = StringListConverter.class)
    @Column(name = "allowed_ip_ranges", nullable = false, columnDefinition = "TEXT")
    @Builder.Default
    private List<String> allowedIpRanges = new ArrayList<>();
}
