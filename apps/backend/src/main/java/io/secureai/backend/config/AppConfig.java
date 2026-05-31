package io.secureai.backend.config;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import dev.samstevens.totp.qr.QrGenerator;
import dev.samstevens.totp.qr.ZxingPngQrGenerator;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClient;

@Configuration
@EnableCaching
public class AppConfig {

    /**
     * WebClient.Builder 수동 등록 — Spring Boot 4.0.5 servlet(MVC) 앱에서 webflux 의존성이
     * 있어도 WebClientAutoConfiguration이 Builder 빈을 제공하지 않아, 이를 주입받는
     * SlackWebhookAdapter·MonitoringService 부팅 실패(UnsatisfiedDependency)를 방지한다.
     */
    @Bean
    public WebClient.Builder webClientBuilder() {
        return WebClient.builder();
    }

    @Bean
    public ObjectMapper objectMapper() {
        return new ObjectMapper()
                .registerModule(new JavaTimeModule())
                .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
                .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
    }

    /**
     * totp-spring-boot-starter:1.7.1 은 spring.factories 방식으로만 AutoConfiguration을 등록한다.
     * Spring Boot 3+ 에서는 AutoConfiguration.imports 방식을 사용하므로 자동 등록이 되지 않아
     * QrGenerator 빈을 수동으로 등록한다.
     */
    @Bean
    public QrGenerator qrGenerator() {
        return new ZxingPngQrGenerator();
    }
}
