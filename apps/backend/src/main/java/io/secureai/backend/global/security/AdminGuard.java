package io.secureai.backend.global.security;

import io.secureai.backend.domain.user.entity.User;
import io.secureai.backend.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * SpEL 기반 관리자 권한 검증 컴포넌트.
 *
 * 사용 예:
 * {@code @PreAuthorize("@adminGuard.check(authentication)")}
 *
 * 성능 최적화(Redis 캐싱)는 추후 적용 — 현재는 일관성 우선.
 */
@Component
@RequiredArgsConstructor
public class AdminGuard {

    private final UserRepository userRepository;

    /**
     * 현재 인증 객체가 관리자인지 확인한다.
     *
     * @param auth Spring Security Authentication 객체
     * @return 인증된 관리자면 true, 그 외 false
     */
    public boolean check(Authentication auth) {
        if (auth == null || !auth.isAuthenticated()) {
            return false;
        }
        UUID userId = (UUID) auth.getPrincipal();
        return userRepository.findById(userId)
                .map(User::getIsAdmin)
                .orElse(false);
    }
}
