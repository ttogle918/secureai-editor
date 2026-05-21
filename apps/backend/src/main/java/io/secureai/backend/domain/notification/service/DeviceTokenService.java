package io.secureai.backend.domain.notification.service;

import io.secureai.backend.domain.notification.entity.DeviceToken;
import io.secureai.backend.domain.notification.repository.DeviceTokenRepository;
import io.secureai.backend.domain.user.entity.User;
import io.secureai.backend.domain.user.repository.UserRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class DeviceTokenService {

    private final DeviceTokenRepository deviceTokenRepository;
    private final UserRepository userRepository;

    /**
     * FCM 디바이스 토큰 등록 — 이미 등록된 토큰은 무시(upsert).
     * 보안: 토큰 값은 로그에 출력하지 않는다.
     */
    @Transactional
    public void registerToken(UUID userId, String token) {
        if (deviceTokenRepository.existsByUserIdAndToken(userId, token)) {
            log.debug("[fcm] token already registered userId={}", userId);
            return;
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new EntityNotFoundException("User not found: " + userId));
        DeviceToken deviceToken = DeviceToken.builder()
                .user(user)
                .token(token)
                .deviceType("android")
                .build();
        deviceTokenRepository.save(deviceToken);
        log.info("[fcm] device token registered userId={}", userId);
    }

    /**
     * FCM 디바이스 토큰 삭제.
     */
    @Transactional
    public void removeToken(UUID userId, String token) {
        deviceTokenRepository.deleteByUserIdAndToken(userId, token);
        log.info("[fcm] device token removed userId={}", userId);
    }

    /**
     * 특정 사용자의 모든 FCM 토큰 조회 — 발송 대상 목록 구성용.
     */
    @Transactional(readOnly = true)
    public List<String> findTokensByUserId(UUID userId) {
        return deviceTokenRepository.findByUserId(userId).stream()
                .map(DeviceToken::getToken)
                .toList();
    }
}
