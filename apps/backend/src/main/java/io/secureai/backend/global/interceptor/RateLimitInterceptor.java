package io.secureai.backend.global.interceptor;

import io.secureai.backend.domain.user.repository.UserRepository;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.time.Duration;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Slf4j
@Component
@RequiredArgsConstructor
public class RateLimitInterceptor implements HandlerInterceptor {

    private final RedisTemplate<String, String> redisTemplate;
    private final UserRepository userRepository;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || !(auth.getPrincipal() instanceof UUID userId)) {
            return true;
        }

        int limitPerMin = resolveRateLimit(userId);
        if (limitPerMin == -1) {
            return true;
        }

        String key = "secureai:ratelimit:%s:api".formatted(userId);
        Long count = redisTemplate.opsForValue().increment(key);

        if (count == 1) {
            redisTemplate.expire(key, Duration.ofMinutes(1));
        }

        long remaining = Math.max(0, limitPerMin - count);
        long resetAt = System.currentTimeMillis() / 1000 + 60;

        response.setHeader("X-RateLimit-Limit", String.valueOf(limitPerMin));
        response.setHeader("X-RateLimit-Remaining", String.valueOf(remaining));
        response.setHeader("X-RateLimit-Reset", String.valueOf(resetAt));

        if (count > limitPerMin) {
            throw new BusinessException(ErrorCode.RATE_LIMIT_EXCEEDED,
                    "분당 최대 %d회 요청 가능합니다.".formatted(limitPerMin));
        }
        return true;
    }

    private int resolveRateLimit(UUID userId) {
        return userRepository.findByIdWithPlan(userId)
                .map(user -> (int) user.getPlan().getApiRateLimitPerMin())
                .orElse(10);
    }
}
