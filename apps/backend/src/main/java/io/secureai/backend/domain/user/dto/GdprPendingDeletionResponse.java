package io.secureai.backend.domain.user.dto;

import io.secureai.backend.domain.user.entity.User;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * GDPR 소프트 삭제 대기 중인 사용자 정보 응답 DTO.
 * 관리자 모니터링용 — 30일 이후 하드 삭제 예정 계정 목록에 사용된다.
 */
public record GdprPendingDeletionResponse(
        UUID userId,
        String email,
        String username,
        OffsetDateTime deletedAt,
        OffsetDateTime scheduledHardDeleteAt
) {
    private static final int HARD_DELETE_DAYS = 30;

    public static GdprPendingDeletionResponse from(User user) {
        return new GdprPendingDeletionResponse(
                user.getId(),
                user.getEmail(),
                user.getUsername(),
                user.getDeletedAt(),
                user.getDeletedAt().plusDays(HARD_DELETE_DAYS)
        );
    }
}
