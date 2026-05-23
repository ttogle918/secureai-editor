package io.secureai.backend.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;

/**
 * Firebase 초기화 설정.
 * firebase.enabled=true 일 때만 활성화되며,
 * 개발 환경(false)에서는 빈이 등록되지 않아 FcmPushService 가 no-op 폴백으로 동작한다.
 */
@Slf4j
@Configuration
@ConditionalOnProperty(name = "firebase.enabled", havingValue = "true", matchIfMissing = false)
public class FcmConfig {

    @Value("${firebase.credentials-path:}")
    private String credentialsPath;

    @Bean
    public FirebaseApp firebaseApp() throws IOException {
        // 이미 초기화된 경우 기존 인스턴스 반환
        if (!FirebaseApp.getApps().isEmpty()) {
            log.info("[fcm] FirebaseApp already initialized, reusing existing instance");
            return FirebaseApp.getInstance();
        }

        InputStream credentialsStream = resolveCredentials();
        FirebaseOptions options = FirebaseOptions.builder()
                .setCredentials(GoogleCredentials.fromStream(credentialsStream))
                .build();
        FirebaseApp app = FirebaseApp.initializeApp(options);
        log.info("[fcm] FirebaseApp initialized successfully");
        return app;
    }

    private InputStream resolveCredentials() throws IOException {
        if (credentialsPath != null && !credentialsPath.isBlank()) {
            // 파일 시스템 경로 — 서비스 계정 JSON
            return new FileInputStream(credentialsPath);
        }
        // 클래스패스 폴백 (테스트/CI 용도)
        InputStream classpathStream = getClass().getResourceAsStream("/firebase-service-account.json");
        if (classpathStream == null) {
            throw new IllegalStateException(
                    "Firebase credentials not found. Set firebase.credentials-path or place firebase-service-account.json in resources.");
        }
        return classpathStream;
    }
}
