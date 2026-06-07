package io.secureai.backend.config;

import io.secureai.backend.global.security.InternalKeyAuthFilter;
import io.secureai.backend.global.security.IpAllowlistFilter;
import io.secureai.backend.global.security.JwtAuthenticationFilter;
import jakarta.servlet.DispatcherType;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final InternalKeyAuthFilter internalKeyAuthFilter;
    private final IpAllowlistFilter ipAllowlistFilter;

    @Value("${secureai.cors.allowed-origins:http://localhost:3000}")
    private String allowedOrigins;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .headers(headers -> headers
                .contentSecurityPolicy(csp -> csp
                    .policyDirectives("default-src 'self'; script-src 'self'; " +
                        "style-src 'self' 'unsafe-inline'; img-src 'self' data:; " +
                        "connect-src 'self'; frame-ancestors 'none'"))
                .httpStrictTransportSecurity(hsts -> hsts
                    .includeSubDomains(true)
                    .maxAgeInSeconds(31536000))
                .frameOptions(frame -> frame.deny())
                .contentTypeOptions(Customizer.withDefaults())
                .referrerPolicy(referrer -> referrer
                    .policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN))
            )
            .authorizeHttpRequests(auth -> auth
                // SSE/비동기 재디스패치는 원래 요청에서 이미 인증됨 — 재인증 불필요
                .dispatcherTypeMatchers(DispatcherType.ASYNC, DispatcherType.ERROR).permitAll()
                // 2FA 관리 엔드포인트 — /api/v1/auth/** 의 permitAll 보다 먼저 매칭해야 함
                .requestMatchers("/api/v1/auth/2fa/**").authenticated()
                .requestMatchers(
                    "/api/v1/auth/**",
                    "/api/workspace/**",
                    "/actuator/health",
                    "/actuator/info",
                    "/actuator/prometheus",
                    "/swagger-ui/**",
                    "/swagger-ui.html",
                    "/v3/api-docs/**",
                    "/error"
                ).permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/reports/download/*").permitAll()
                // 보안 문서 토큰 다운로드 — 다운로드 토큰 자체가 인증 수단
                .requestMatchers(HttpMethod.GET, "/api/v1/reports/security/download").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/invitations/**").permitAll()
                // GitHub 웹훅 인바운드만 공개 — GET /history 등 나머지는 JWT 필요
                .requestMatchers(HttpMethod.POST, "/webhooks/github").permitAll()
                // 내부 통신 엔드포인트 — JWT 불필요, InternalKeyAuthFilter가 X-Internal-Key 헤더 검증
                .requestMatchers("/api/v1/internal/**").permitAll()
                // 팀 설정 관리 — 관리자 전용 (adminGuard.check로 2차 검증)
                .requestMatchers("/api/v1/admin/teams/**").authenticated()
                // AI Engine 내부 호출 전용 — InternalKeyFilter 에서 인증
                .requestMatchers("/api/v1/cve/search").permitAll()
                // SBOM 컴포넌트 저장은 /api/v1/internal/** 로 이전됨 → InternalKeyAuthFilter가 보호(별도 permitAll 불필요)
                // FCM 디바이스 토큰 등록/삭제 — JWT 인증 필요 (anyRequest 에 포함되나 명시)
                // /api/v1/fcm/** 는 별도 permitAll 없으므로 JWT 인증 필수
                .anyRequest().authenticated()
            )
            .exceptionHandling(e -> e
                .authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED))
            )
            .addFilterBefore(internalKeyAuthFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterBefore(ipAllowlistFilter, JwtAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of(allowedOrigins.split(",")));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);
        config.setExposedHeaders(List.of("X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"));

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
