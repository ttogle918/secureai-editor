package io.secureai.backend.config;

import net.javacrumbs.shedlock.core.LockProvider;
import net.javacrumbs.shedlock.provider.redis.spring.RedisLockProvider;
import net.javacrumbs.shedlock.spring.annotation.EnableSchedulerLock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;

/**
 * ShedLock 설정 — Redis Provider 사용.
 * 분산 환경(다중 인스턴스)에서 스케줄러 중복 실행을 방지한다.
 *
 * @EnableScheduling 은 BackendApplication 에 이미 선언되어 있으므로 여기서는 생략한다.
 * 키 접두사 "shedlock:" 를 사용해 다른 Redis 키와 충돌을 피한다.
 */
@Configuration
@EnableSchedulerLock(defaultLockAtMostFor = "PT10M")
public class SchedulerConfig {

    @Bean
    public LockProvider lockProvider(RedisConnectionFactory connectionFactory) {
        return new RedisLockProvider(connectionFactory, "shedlock:");
    }
}
