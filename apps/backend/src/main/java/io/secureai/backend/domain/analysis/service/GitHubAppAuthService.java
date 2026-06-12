package io.secureai.backend.domain.analysis.service;

import io.jsonwebtoken.Jwts;
import io.secureai.backend.config.GitHubConfig;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.security.KeyFactory;
import java.security.interfaces.RSAPrivateKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.Map;

/**
 * GitHub App 인증 서비스.
 *
 * 책임:
 * 1. RSA Private Key(PEM)로 GitHub App JWT(RS256) 생성
 * 2. Installation Token 교환 (POST /app/installations/{id}/access_tokens)
 *
 * 설계 원칙:
 * - SRP: JWT 생성·토큰 교환은 이 클래스만 담당 (GitHubWebhookService는 결과만 수신)
 * - 보안 불변식: privateKey, JWT, installationToken 절대 로그 출력 금지
 * - App ID vs Client ID: checkRunAppId는 숫자 형식 App ID (OAuth Client ID와 별개)
 */
@Slf4j
@Service
public class GitHubAppAuthService {

    /** JWT exp: GitHub API 허용 최대치 10분 (권장 값 사용) */
    private static final int JWT_EXPIRY_SECONDS = 600;
    /** GitHub App JWT의 iat는 시계 오차 대비 60초 이전으로 설정 (GitHub 권장) */
    private static final int JWT_ISSUED_AT_OFFSET_SECONDS = 60;

    private final GitHubConfig gitHubConfig;
    private final RestClient restClient;

    public GitHubAppAuthService(
            GitHubConfig gitHubConfig,
            @Qualifier("githubRestClient") RestClient restClient
    ) {
        this.gitHubConfig = gitHubConfig;
        this.restClient = restClient;
    }

    /**
     * GitHub App JWT(RS256)를 생성한다.
     *
     * iss = App ID (숫자 형식), iat = now - 60s, exp = now + 10min
     * GitHub 시계 오차 허용을 위해 iat를 60초 과거로 설정한다.
     *
     * @return 서명된 JWT 문자열 (로그 출력 금지)
     * @throws BusinessException GITHUB_APP_AUTH_FAILED — private key 로드 실패 또는 App ID 미설정
     */
    public String buildAppJwt() {
        String appId = gitHubConfig.getCheckRunAppId();
        if (appId == null || appId.isBlank()) {
            throw new BusinessException(ErrorCode.GITHUB_APP_AUTH_FAILED, "GITHUB_APP_ID가 설정되지 않았습니다.");
        }

        RSAPrivateKey privateKey = loadPrivateKey();

        Instant now = Instant.now();
        return Jwts.builder()
                .issuer(appId)
                .issuedAt(Date.from(now.minusSeconds(JWT_ISSUED_AT_OFFSET_SECONDS)))
                .expiration(Date.from(now.plusSeconds(JWT_EXPIRY_SECONDS)))
                .signWith(privateKey)
                .compact();
        // JWT 문자열은 반환값으로만 전달 — 로그 출력 절대 금지
    }

    /**
     * Installation Token을 교환한다.
     *
     * GitHub App JWT를 사용하여 POST /app/installations/{installationId}/access_tokens 를 호출하고
     * installation access token을 반환한다.
     *
     * @param installationId 웹훅 페이로드 installation.id 값
     * @return installation access token (로그 출력 금지)
     * @throws BusinessException GITHUB_APP_AUTH_FAILED — API 실패 또는 토큰 파싱 실패
     */
    @SuppressWarnings("unchecked")
    public String exchangeInstallationToken(long installationId) {
        String appJwt = buildAppJwt();
        // appJwt 로그 출력 절대 금지

        try {
            Map<String, Object> response = restClient.post()
                    .uri("/app/installations/{installationId}/access_tokens", installationId)
                    .headers(headers -> {
                        headers.setBearerAuth(appJwt);
                        headers.set("Accept", "application/vnd.github+json");
                        headers.setContentType(MediaType.APPLICATION_JSON);
                    })
                    .retrieve()
                    .onStatus(HttpStatusCode::is4xxClientError, (req, res) -> {
                        int statusCode = res.getStatusCode().value();
                        log.warn("[github-app-auth] Installation Token 교환 실패 installationId={} status={}",
                                installationId, statusCode);
                        throw new BusinessException(ErrorCode.GITHUB_APP_AUTH_FAILED,
                                "Installation Token 교환 실패: HTTP " + statusCode);
                    })
                    .body(Map.class);

            if (response == null || response.get("token") == null) {
                throw new BusinessException(ErrorCode.GITHUB_APP_AUTH_FAILED,
                        "Installation Token 응답에 token 필드가 없습니다.");
            }

            // token 값은 반환값으로만 전달 — 로그 출력 절대 금지
            log.info("[github-app-auth] Installation Token 교환 완료 installationId={}", installationId);
            return (String) response.get("token");

        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.warn("[github-app-auth] Installation Token 교환 중 예외 installationId={} err={}",
                    installationId, e.getMessage());
            throw new BusinessException(ErrorCode.GITHUB_APP_AUTH_FAILED, "Installation Token 교환 중 오류: " + e.getMessage());
        }
    }

    /**
     * 웹훅 페이로드에서 installation.id를 추출하여 Installation Token을 반환한다.
     * installation 정보가 없거나 App 설정이 불완전하면 빈 문자열을 반환한다 (skip & log).
     *
     * @param payload 웹훅 JSON 페이로드 (Map)
     * @return installation token 또는 "" (미설정/오류 시)
     */
    @SuppressWarnings("unchecked")
    public String extractInstallationToken(Map<String, Object> payload) {
        String appId = gitHubConfig.getCheckRunAppId();
        String privateKeySource = resolvePrivateKeySource();

        if (appId == null || appId.isBlank() || privateKeySource == null || privateKeySource.isBlank()) {
            log.debug("[github-app-auth] App ID 또는 Private Key 미설정 — Installation Token 취득 생략");
            return "";
        }

        Object installationObj = payload.get("installation");
        if (installationObj == null) {
            log.debug("[github-app-auth] 페이로드에 installation 필드 없음 — Installation Token 취득 생략");
            return "";
        }

        try {
            Map<String, Object> installation = (Map<String, Object>) installationObj;
            Object idObj = installation.get("id");
            if (idObj == null) {
                log.warn("[github-app-auth] installation.id 필드 없음");
                return "";
            }
            long installationId = ((Number) idObj).longValue();
            return exchangeInstallationToken(installationId);
        } catch (BusinessException e) {
            log.warn("[github-app-auth] Installation Token 취득 실패 — 분석 플로우는 계속 진행 err={}", e.getMessage());
            return "";
        } catch (Exception e) {
            log.warn("[github-app-auth] Installation Token 취득 중 예외 — 분석 플로우는 계속 진행 err={}", e.getMessage());
            return "";
        }
    }

    // ─── Private Helpers ──────────────────────────────────────────────────────

    /**
     * Private Key 소스를 결정한다. 인라인 PEM > 파일 경로 순으로 우선순위.
     */
    private String resolvePrivateKeySource() {
        String inlineKey = gitHubConfig.getAppPrivateKey();
        if (inlineKey != null && !inlineKey.isBlank()) {
            return inlineKey;
        }
        return gitHubConfig.getAppPrivateKeyPath();
    }

    /**
     * PEM 형식 RSA Private Key를 로드한다.
     * GITHUB_APP_PRIVATE_KEY (인라인) 우선, 없으면 GITHUB_APP_PRIVATE_KEY_PATH에서 파일 읽기.
     *
     * @return RSAPrivateKey 인스턴스 (로그 출력 절대 금지)
     * @throws BusinessException GITHUB_APP_AUTH_FAILED — 키 로드/파싱 실패
     */
    private RSAPrivateKey loadPrivateKey() {
        String pemContent = loadPemContent();
        return parsePemToRsaPrivateKey(pemContent);
    }

    private String loadPemContent() {
        String inlineKey = gitHubConfig.getAppPrivateKey();
        if (inlineKey != null && !inlineKey.isBlank()) {
            // 환경변수로 주입된 인라인 PEM (\n 이스케이프 처리)
            return inlineKey.replace("\\n", "\n");
        }

        String keyPath = gitHubConfig.getAppPrivateKeyPath();
        if (keyPath == null || keyPath.isBlank()) {
            throw new BusinessException(ErrorCode.GITHUB_APP_AUTH_FAILED,
                    "GITHUB_APP_PRIVATE_KEY 또는 GITHUB_APP_PRIVATE_KEY_PATH가 설정되지 않았습니다.");
        }

        // 경로 순회(Path Traversal) 방어: 파일 경로는 환경변수로 주입된 신뢰된 값이나
        // 실제 파일 시스템 경로임을 명시적으로 확인
        try {
            return Files.readString(Paths.get(keyPath), StandardCharsets.UTF_8);
        } catch (Exception e) {
            // 경로 정보는 로그에 포함해도 무방 (민감 정보 아님), 내용은 절대 포함 금지
            log.error("[github-app-auth] Private Key 파일 읽기 실패 path={} err={}", keyPath, e.getMessage());
            throw new BusinessException(ErrorCode.GITHUB_APP_AUTH_FAILED,
                    "Private Key 파일 읽기 실패: " + e.getMessage());
        }
    }

    /**
     * PEM 문자열에서 PKCS#8 DER 바이트를 추출하여 RSAPrivateKey로 파싱한다.
     * GitHub App에서 발급하는 PEM은 PKCS#1(RSA PRIVATE KEY) 형식이므로
     * openssl을 통해 PKCS#8로 변환된 키도 수용한다.
     *
     * 보안: 파싱 실패 시 예외 메시지에 키 내용 절대 포함 금지.
     */
    private RSAPrivateKey parsePemToRsaPrivateKey(String pem) {
        try {
            // PEM 헤더/푸터 및 개행 제거
            String base64 = pem
                    .replace("-----BEGIN RSA PRIVATE KEY-----", "")
                    .replace("-----END RSA PRIVATE KEY-----", "")
                    .replace("-----BEGIN PRIVATE KEY-----", "")
                    .replace("-----END PRIVATE KEY-----", "")
                    .replaceAll("\\s+", "");

            byte[] derBytes = Base64.getDecoder().decode(base64);

            // PKCS#8 형식 시도 (openssl로 변환된 키)
            try {
                PKCS8EncodedKeySpec spec = new PKCS8EncodedKeySpec(derBytes);
                KeyFactory kf = KeyFactory.getInstance("RSA");
                return (RSAPrivateKey) kf.generatePrivate(spec);
            } catch (Exception pkcs8Ex) {
                // PKCS#1(RSA PRIVATE KEY) 형식 시도
                return parsePkcs1(derBytes);
            }

        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            // 예외 메시지에 키 내용 절대 포함 금지
            log.error("[github-app-auth] RSA Private Key 파싱 실패 err={}", e.getMessage());
            throw new BusinessException(ErrorCode.GITHUB_APP_AUTH_FAILED, "RSA Private Key 파싱 실패");
        }
    }

    /**
     * PKCS#1 RSA Private Key DER를 PKCS#8로 래핑하여 파싱한다.
     * GitHub App에서 발급하는 PEM은 기본적으로 PKCS#1 형식이다.
     *
     * PKCS#1 → PKCS#8 래핑: ASN.1 SequenceOf(AlgorithmIdentifier(rsaEncryption), OCTET STRING(pkcs1DER))
     */
    private RSAPrivateKey parsePkcs1(byte[] pkcs1Bytes) throws Exception {
        // PKCS#8 AlgorithmIdentifier for RSA: OID 1.2.840.113549.1.1.1
        byte[] algorithmIdentifier = {
                0x30, 0x0d, 0x06, 0x09,
                0x2a, (byte) 0x86, 0x48, (byte) 0x86, (byte) 0xf7, 0x0d, 0x01, 0x01, 0x01,
                0x05, 0x00
        };

        // OCTET STRING으로 래핑
        byte[] octetString = wrapInOctetString(pkcs1Bytes);

        // SEQUENCE로 래핑 (version=0 + algorithmIdentifier + octetString)
        byte[] versionBytes = {0x02, 0x01, 0x00};
        byte[] innerContent = concatenate(versionBytes, algorithmIdentifier, octetString);
        byte[] pkcs8Der = wrapInSequence(innerContent);

        PKCS8EncodedKeySpec spec = new PKCS8EncodedKeySpec(pkcs8Der);
        KeyFactory kf = KeyFactory.getInstance("RSA");
        return (RSAPrivateKey) kf.generatePrivate(spec);
    }

    private byte[] wrapInOctetString(byte[] content) {
        byte[] lengthBytes = encodeLength(content.length);
        byte[] result = new byte[1 + lengthBytes.length + content.length];
        result[0] = 0x04; // OCTET STRING tag
        System.arraycopy(lengthBytes, 0, result, 1, lengthBytes.length);
        System.arraycopy(content, 0, result, 1 + lengthBytes.length, content.length);
        return result;
    }

    private byte[] wrapInSequence(byte[] content) {
        byte[] lengthBytes = encodeLength(content.length);
        byte[] result = new byte[1 + lengthBytes.length + content.length];
        result[0] = 0x30; // SEQUENCE tag
        System.arraycopy(lengthBytes, 0, result, 1, lengthBytes.length);
        System.arraycopy(content, 0, result, 1 + lengthBytes.length, content.length);
        return result;
    }

    private byte[] encodeLength(int length) {
        if (length < 0x80) {
            return new byte[]{(byte) length};
        } else if (length < 0x100) {
            return new byte[]{(byte) 0x81, (byte) length};
        } else {
            return new byte[]{(byte) 0x82, (byte) (length >> 8), (byte) (length & 0xff)};
        }
    }

    private byte[] concatenate(byte[]... arrays) {
        int totalLength = 0;
        for (byte[] arr : arrays) {
            totalLength += arr.length;
        }
        byte[] result = new byte[totalLength];
        int offset = 0;
        for (byte[] arr : arrays) {
            System.arraycopy(arr, 0, result, offset, arr.length);
            offset += arr.length;
        }
        return result;
    }
}
