package io.secureai.backend.domain.cleanup.service;

import io.secureai.backend.domain.user.repository.RefreshTokenRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;

/**
 * 만료·폐기된 Refresh Token 정리 Job.
 * 매일 새벽 1시에 실행되어 expiresAt < now AND revokedAt IS NOT NULL 인 토큰을 삭제한다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RefreshTokenCleanupJob {

    private final RefreshTokenRepository refreshTokenRepository;

    @Scheduled(cron = "0 0 1 * * *")
    @SchedulerLock(name = "refreshTokenCleanupJob", lockAtMostFor = "PT30M", lockAtLeastFor = "PT5M")
    @Transactional
    public void cleanupExpiredTokens() {
        int deleted = refreshTokenRepository.deleteExpiredAndRevoked(OffsetDateTime.now());
        log.info("[token-cleanup] 만료·폐기 토큰 {}건 삭제", deleted);
    }
}
