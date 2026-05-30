package io.secureai.backend.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.StringRedisSerializer;

import java.time.Duration;
import java.util.Map;

@Configuration
@EnableCaching
public class RedisCacheConfig {

    private static final Duration DEFAULT_TTL        = Duration.ofMinutes(10);
    private static final Duration PROJECT_DETAIL_TTL = Duration.ofMinutes(10);
    private static final Duration DASHBOARD_TTL      = Duration.ofMinutes(5);
    // CVE 목록: NVD API 호출 부하 감소를 위해 6시간 캐시 (NvdApiClient 자체 Redis 캐시와 TTL 통일)
    private static final Duration CVE_LIST_TTL       = Duration.ofHours(6);

    @Bean
    public RedisCacheManager cacheManager(RedisConnectionFactory connectionFactory) {
        // GenericJackson2JsonRedisSerializer: @class 프로퍼티로 타입 정보 보존.
        // Jackson2JsonRedisSerializer<Object> + NON_FINAL 조합은 Java record(final class)를
        // 타입 정보 없이 직렬화하여 역직렬화 시 WRAPPER_ARRAY 불일치 오류를 유발한다.
        ObjectMapper objectMapper = buildObjectMapper();
        // Spring Data Redis 3.4+/4.0: GenericJackson2JsonRedisSerializer(ObjectMapper)
        // 생성자가 deprecated(removal) → builder 로 동일 동작 구성.
        GenericJackson2JsonRedisSerializer jsonSerializer =
                GenericJackson2JsonRedisSerializer.builder()
                        .objectMapper(objectMapper)
                        .build();

        RedisCacheConfiguration defaultConfig = RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(DEFAULT_TTL)
                .serializeKeysWith(
                        RedisSerializationContext.SerializationPair.fromSerializer(new StringRedisSerializer()))
                .serializeValuesWith(
                        RedisSerializationContext.SerializationPair.fromSerializer(jsonSerializer))
                .disableCachingNullValues();

        Map<String, RedisCacheConfiguration> cacheConfigs = Map.of(
                "projectDetail", defaultConfig.entryTtl(PROJECT_DETAIL_TTL),
                "dashboard",     defaultConfig.entryTtl(DASHBOARD_TTL),
                "cveList",       defaultConfig.entryTtl(CVE_LIST_TTL)
        );

        return RedisCacheManager.builder(connectionFactory)
                .cacheDefaults(defaultConfig)
                .withInitialCacheConfigurations(cacheConfigs)
                .build();
    }

    private ObjectMapper buildObjectMapper() {
        ObjectMapper mapper = new ObjectMapper();
        mapper.registerModule(new JavaTimeModule());
        mapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        // @class 프로퍼티로 타입 정보 저장 — NON_FINAL은 final 클래스(record)를 제외하지만
        // EVERYTHING은 record 포함 모든 타입의 역직렬화를 보장한다.
        // As.PROPERTY 방식은 WRAPPER_ARRAY보다 안정적이며 중첩 객체에서도 정확하다.
        mapper.activateDefaultTypingAsProperty(
                mapper.getPolymorphicTypeValidator(),
                ObjectMapper.DefaultTyping.EVERYTHING,
                "@class"
        );
        return mapper;
    }
}
