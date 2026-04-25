package io.secureai.backend.domain.project.dto;

import io.secureai.backend.domain.project.entity.TeamMember;
import lombok.Builder;
import lombok.Getter;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Builder
public class TeamMemberResponse {

    private UUID id;
    private UUID userId;
    private String username;
    private String displayName;
    private String email;
    private String role;
    private OffsetDateTime invitedAt;
    private OffsetDateTime acceptedAt;

    public static TeamMemberResponse from(TeamMember member) {
        return TeamMemberResponse.builder()
                .id(member.getId())
                .userId(member.getUser().getId())
                .username(member.getUser().getUsername())
                .displayName(member.getUser().getDisplayName())
                .email(member.getUser().getEmail())
                .role(member.getRole())
                .invitedAt(member.getInvitedAt())
                .acceptedAt(member.getAcceptedAt())
                .build();
    }
}
