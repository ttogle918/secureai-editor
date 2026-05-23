package io.secureai.backend.domain.monitoring.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import javax.net.ssl.HttpsURLConnection;
import java.net.URI;
import java.net.URL;
import java.security.cert.Certificate;
import java.security.cert.X509Certificate;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Optional;

/**
 * HTTPS 엔드포인트에서 SSL 인증서 만료일을 파싱하는 컴포넌트.
 *
 * <p>SRP: SSL 인증서 파싱 책임만 담당한다.
 * 외부 라이브러리 없이 {@link HttpsURLConnection}과 {@link X509Certificate}만 사용한다.
 */
@Slf4j
@Component
public class SslCertChecker {

    private static final int CONNECT_TIMEOUT_MS = 5_000;
    private static final int READ_TIMEOUT_MS = 5_000;

    /**
     * 주어진 HTTPS URL의 SSL 인증서 만료일을 반환한다.
     *
     * @param urlString 체크할 HTTPS URL (ex: "https://example.com")
     * @return 인증서 만료일, 연결 실패 또는 인증서 파싱 오류 시 {@code Optional.empty()}
     */
    public Optional<LocalDate> checkSsl(String urlString) {
        HttpsURLConnection connection = null;
        try {
            URL url = URI.create(urlString).toURL();
            connection = (HttpsURLConnection) url.openConnection();
            connection.setConnectTimeout(CONNECT_TIMEOUT_MS);
            connection.setReadTimeout(READ_TIMEOUT_MS);
            connection.connect();

            Certificate[] certs = connection.getServerCertificates();
            if (certs == null || certs.length == 0) {
                log.warn("[ssl-checker] 인증서 없음 url={}", urlString);
                return Optional.empty();
            }

            X509Certificate leafCert = (X509Certificate) certs[0];
            LocalDate expiryDate = leafCert.getNotAfter()
                    .toInstant()
                    .atZone(ZoneId.systemDefault())
                    .toLocalDate();
            return Optional.of(expiryDate);

        } catch (Exception e) {
            log.warn("[ssl-checker] SSL 인증서 파싱 실패 url={} reason={}", urlString, e.getMessage());
            return Optional.empty();
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }
    }
}
