package io.secureai.backend.domain.analysis.service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.secureai.backend.config.GitHubConfig;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.client.RestClient;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.util.Base64;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.function.Consumer;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * GitHubAppAuthService 단위 테스트.
 *
 * 테스트 항목:
 * - JWT(RS256) 생성 정상 동작: iss=AppID, iat/exp 범위 검증
 * - App ID 미설정 시 GITHUB_APP_AUTH_FAILED 예외
 * - Private Key 미설정 시 GITHUB_APP_AUTH_FAILED 예외
 * - Installation Token 교환: mock RestClient 응답 파싱 검증
 * - Installation Token 교환 실패(4xx) 시 예외
 * - extractInstallationToken: installation 없는 페이로드 → 빈 문자열 반환
 * - extractInstallationToken: App ID/Key 미설정 → 빈 문자열 반환 (skip & log)
 *
 * 외부 HTTP 호출(GitHub API)은 RestClient mock으로 격리한다.
 * 보안: 테스트 내에서도 JWT/token 값은 로그 출력 금지.
 */
@ExtendWith(MockitoExtension.class)
class GitHubAppAuthServiceTest {

    /** 테스트용 RSA 2048비트 키쌍 (실 키와 동일한 알고리즘) */
    private static final KeyPair TEST_KEY_PAIR;
    private static final String TEST_PEM_PRIVATE_KEY;
    private static final String TEST_APP_ID = "123456";

    static {
        try {
            KeyPairGenerator gen = KeyPairGenerator.getInstance("RSA");
            gen.initialize(2048);
            TEST_KEY_PAIR = gen.generateKeyPair();

            // PKCS#8 형식으로 PEM 구성 (테스트 편의 — 실제 GitHub App은 PKCS#1이지만 PKCS#8도 지원)
            byte[] pkcs8Bytes = TEST_KEY_PAIR.getPrivate().getEncoded();
            String base64 = Base64.getMimeEncoder(64, new byte[]{'\n'}).encodeToString(pkcs8Bytes);
            TEST_PEM_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\n" + base64 + "\n-----END PRIVATE KEY-----";
        } catch (Exception e) {
            throw new RuntimeException("테스트 RSA 키 생성 실패", e);
        }
    }

    @Mock
    private RestClient.RequestBodyUriSpec requestBodyUriSpec;
    @Mock
    private RestClient.RequestBodySpec requestBodySpec;
    @Mock
    private RestClient.ResponseSpec responseSpec;
    @Mock
    private RestClient restClient;

    private GitHubConfig gitHubConfig;
    private GitHubAppAuthService authService;

    @BeforeEach
    void setUp() {
        gitHubConfig = new GitHubConfig();
        // 기본 설정: App ID + 인라인 Private Key
        gitHubConfig.setCheckRunAppId(TEST_APP_ID);
        gitHubConfig.setAppPrivateKey(TEST_PEM_PRIVATE_KEY);
        gitHubConfig.setAppPrivateKeyPath("");

        authService = new GitHubAppAuthService(gitHubConfig, restClient);
    }

    // ─── buildAppJwt 테스트 ──────────────────────────────────────────────────

    @Nested
    @DisplayName("buildAppJwt — JWT 생성")
    class BuildAppJwtTests {

        @Test
        @DisplayName("App ID와 Private Key가 설정되면 유효한 RS256 JWT를 생성한다")
        void buildAppJwt_withValidConfig_returnsSignedJwt() {
            String jwt = authService.buildAppJwt();

            assertThat(jwt).isNotBlank();

            // RS256 서명 검증: 생성 시 사용한 공개키로 파싱 가능해야 함
            RSAPublicKey publicKey = (RSAPublicKey) TEST_KEY_PAIR.getPublic();
            Claims claims = Jwts.parser()
                    .verifyWith(publicKey)
                    .build()
                    .parseSignedClaims(jwt)
                    .getPayload();

            // iss = App ID
            assertThat(claims.getIssuer()).isEqualTo(TEST_APP_ID);

            // iat는 현재 시각보다 약간 이전 (60초 offset)
            Date iat = claims.getIssuedAt();
            Date now = new Date();
            assertThat(iat).isBefore(now);

            // exp는 현재 시각보다 미래
            Date exp = claims.getExpiration();
            assertThat(exp).isAfter(now);
            // GitHub는 exp가 자기 시계 기준 600s 초과면 거부 → exp는 now+600 이내여야 한다.
            // (스큐 마진 위해 540s 사용. 이 상한을 어기면 라이브에서 401 발생 — 회귀 가드)
            long expFromNowSeconds = (exp.getTime() - now.getTime()) / 1000;
            assertThat(expFromNowSeconds).isLessThanOrEqualTo(600);
            // exp - iat == offset(60) + expiry(540) = 600
            long diffSeconds = (exp.getTime() - iat.getTime()) / 1000;
            assertThat(diffSeconds).isLessThanOrEqualTo(600);
        }

        @Test
        @DisplayName("App ID가 빈 문자열이면 GITHUB_APP_AUTH_FAILED 예외가 발생한다")
        void buildAppJwt_withBlankAppId_throwsGithubAppAuthFailed() {
            gitHubConfig.setCheckRunAppId("");

            assertThatThrownBy(() -> authService.buildAppJwt())
                    .isInstanceOf(BusinessException.class)
                    .satisfies(ex -> {
                        BusinessException be = (BusinessException) ex;
                        assertThat(be.getErrorCode()).isEqualTo(ErrorCode.GITHUB_APP_AUTH_FAILED);
                    });
        }

        @Test
        @DisplayName("App ID가 null이면 GITHUB_APP_AUTH_FAILED 예외가 발생한다")
        void buildAppJwt_withNullAppId_throwsGithubAppAuthFailed() {
            gitHubConfig.setCheckRunAppId(null);

            assertThatThrownBy(() -> authService.buildAppJwt())
                    .isInstanceOf(BusinessException.class)
                    .satisfies(ex -> {
                        BusinessException be = (BusinessException) ex;
                        assertThat(be.getErrorCode()).isEqualTo(ErrorCode.GITHUB_APP_AUTH_FAILED);
                    });
        }

        @Test
        @DisplayName("Private Key가 빈 문자열이고 파일 경로도 없으면 GITHUB_APP_AUTH_FAILED 예외가 발생한다")
        void buildAppJwt_withNoPrivateKey_throwsGithubAppAuthFailed() {
            gitHubConfig.setAppPrivateKey("");
            gitHubConfig.setAppPrivateKeyPath("");

            assertThatThrownBy(() -> authService.buildAppJwt())
                    .isInstanceOf(BusinessException.class)
                    .satisfies(ex -> {
                        BusinessException be = (BusinessException) ex;
                        assertThat(be.getErrorCode()).isEqualTo(ErrorCode.GITHUB_APP_AUTH_FAILED);
                    });
        }

        @Test
        @DisplayName("유효하지 않은 PEM 형식 Private Key이면 GITHUB_APP_AUTH_FAILED 예외가 발생한다")
        void buildAppJwt_withInvalidPem_throwsGithubAppAuthFailed() {
            gitHubConfig.setAppPrivateKey("-----BEGIN PRIVATE KEY-----\nINVALID_BASE64_CONTENT\n-----END PRIVATE KEY-----");

            assertThatThrownBy(() -> authService.buildAppJwt())
                    .isInstanceOf(BusinessException.class)
                    .satisfies(ex -> {
                        BusinessException be = (BusinessException) ex;
                        assertThat(be.getErrorCode()).isEqualTo(ErrorCode.GITHUB_APP_AUTH_FAILED);
                    });
        }
    }

    // ─── exchangeInstallationToken 테스트 ────────────────────────────────────

    @Nested
    @DisplayName("exchangeInstallationToken — Installation Token 교환")
    class ExchangeInstallationTokenTests {

        @SuppressWarnings("unchecked")
        @Test
        @DisplayName("GitHub API가 token을 반환하면 해당 토큰 값을 반환한다")
        void exchangeInstallationToken_withValidResponse_returnsToken() {
            // given: mock RestClient 체인
            long installationId = 99887766L;
            String expectedToken = "ghs_test_installation_token_value";

            Map<String, Object> apiResponse = new HashMap<>();
            apiResponse.put("token", expectedToken);
            apiResponse.put("expires_at", "2099-01-01T00:00:00Z");

            // RestClient 체인 mock 설정
            when(restClient.post()).thenReturn(requestBodyUriSpec);
            when(requestBodyUriSpec.uri(anyString(), eq(installationId))).thenReturn(requestBodySpec);
            when(requestBodySpec.headers(any(Consumer.class))).thenReturn(requestBodySpec);
            when(requestBodySpec.retrieve()).thenReturn(responseSpec);
            when(responseSpec.onStatus(any(), any())).thenReturn(responseSpec);
            when(responseSpec.body(Map.class)).thenReturn(apiResponse);

            // when
            String token = authService.exchangeInstallationToken(installationId);

            // then
            assertThat(token).isEqualTo(expectedToken);
            // token 값은 이 테스트에서도 로그 출력 금지 — 단언만 수행
        }

        @Test
        @DisplayName("GitHub API 응답에 token 필드가 없으면 GITHUB_APP_AUTH_FAILED 예외가 발생한다")
        void exchangeInstallationToken_withMissingTokenField_throwsGithubAppAuthFailed() {
            long installationId = 99887766L;

            Map<String, Object> apiResponse = new HashMap<>();
            // token 필드 없음 (응답 파싱 실패 케이스)
            apiResponse.put("message", "unexpected response");

            when(restClient.post()).thenReturn(requestBodyUriSpec);
            when(requestBodyUriSpec.uri(anyString(), eq(installationId))).thenReturn(requestBodySpec);
            when(requestBodySpec.headers(any(Consumer.class))).thenReturn(requestBodySpec);
            when(requestBodySpec.retrieve()).thenReturn(responseSpec);
            when(responseSpec.onStatus(any(), any())).thenReturn(responseSpec);
            when(responseSpec.body(Map.class)).thenReturn(apiResponse);

            assertThatThrownBy(() -> authService.exchangeInstallationToken(installationId))
                    .isInstanceOf(BusinessException.class)
                    .satisfies(ex -> {
                        BusinessException be = (BusinessException) ex;
                        assertThat(be.getErrorCode()).isEqualTo(ErrorCode.GITHUB_APP_AUTH_FAILED);
                    });
        }

        @Test
        @DisplayName("GitHub API가 null을 반환하면 GITHUB_APP_AUTH_FAILED 예외가 발생한다")
        void exchangeInstallationToken_withNullResponse_throwsGithubAppAuthFailed() {
            long installationId = 99887766L;

            when(restClient.post()).thenReturn(requestBodyUriSpec);
            when(requestBodyUriSpec.uri(anyString(), eq(installationId))).thenReturn(requestBodySpec);
            when(requestBodySpec.headers(any(Consumer.class))).thenReturn(requestBodySpec);
            when(requestBodySpec.retrieve()).thenReturn(responseSpec);
            when(responseSpec.onStatus(any(), any())).thenReturn(responseSpec);
            when(responseSpec.body(Map.class)).thenReturn(null);

            assertThatThrownBy(() -> authService.exchangeInstallationToken(installationId))
                    .isInstanceOf(BusinessException.class)
                    .satisfies(ex -> {
                        BusinessException be = (BusinessException) ex;
                        assertThat(be.getErrorCode()).isEqualTo(ErrorCode.GITHUB_APP_AUTH_FAILED);
                    });
        }
    }

    // ─── extractInstallationToken 테스트 (페이로드 파싱 + 설정 가드) ───────────

    @Nested
    @DisplayName("extractInstallationToken — 페이로드에서 Installation Token 취득")
    class ExtractInstallationTokenTests {

        @Test
        @DisplayName("installation 필드가 없는 페이로드이면 빈 문자열을 반환한다 (skip & log)")
        void extractInstallationToken_withoutInstallationField_returnsEmpty() {
            Map<String, Object> payload = new HashMap<>();
            payload.put("action", "opened");
            // installation 키 없음

            String token = authService.extractInstallationToken(payload);

            assertThat(token).isEmpty();
            // restClient.post()는 호출되지 않아야 함
            verify(restClient, never()).post();
        }

        @Test
        @DisplayName("App ID가 미설정이면 페이로드에 installation이 있어도 빈 문자열을 반환한다")
        void extractInstallationToken_withBlankAppId_returnsEmpty() {
            gitHubConfig.setCheckRunAppId("");

            Map<String, Object> payload = buildPayloadWithInstallation(12345L);

            String token = authService.extractInstallationToken(payload);

            assertThat(token).isEmpty();
            verify(restClient, never()).post();
        }

        @Test
        @DisplayName("Private Key가 미설정이면 페이로드에 installation이 있어도 빈 문자열을 반환한다")
        void extractInstallationToken_withBlankPrivateKey_returnsEmpty() {
            gitHubConfig.setAppPrivateKey("");
            gitHubConfig.setAppPrivateKeyPath("");

            Map<String, Object> payload = buildPayloadWithInstallation(12345L);

            String token = authService.extractInstallationToken(payload);

            assertThat(token).isEmpty();
            verify(restClient, never()).post();
        }

        @Test
        @DisplayName("installation.id가 null이면 빈 문자열을 반환한다 (skip & log)")
        void extractInstallationToken_withNullInstallationId_returnsEmpty() {
            Map<String, Object> installation = new HashMap<>();
            installation.put("id", null); // id 필드가 null

            Map<String, Object> payload = new HashMap<>();
            payload.put("installation", installation);

            String token = authService.extractInstallationToken(payload);

            assertThat(token).isEmpty();
        }

        @SuppressWarnings("unchecked")
        @Test
        @DisplayName("설정이 완전하고 installation.id가 있으면 exchangeInstallationToken을 호출한다")
        void extractInstallationToken_withValidSetupAndPayload_callsExchange() {
            long installationId = 55443322L;
            String expectedToken = "ghs_mock_token";

            Map<String, Object> apiResponse = new HashMap<>();
            apiResponse.put("token", expectedToken);

            when(restClient.post()).thenReturn(requestBodyUriSpec);
            when(requestBodyUriSpec.uri(anyString(), eq(installationId))).thenReturn(requestBodySpec);
            when(requestBodySpec.headers(any(Consumer.class))).thenReturn(requestBodySpec);
            when(requestBodySpec.retrieve()).thenReturn(responseSpec);
            when(responseSpec.onStatus(any(), any())).thenReturn(responseSpec);
            when(responseSpec.body(Map.class)).thenReturn(apiResponse);

            Map<String, Object> payload = buildPayloadWithInstallation(installationId);

            String token = authService.extractInstallationToken(payload);

            assertThat(token).isEqualTo(expectedToken);
        }
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private Map<String, Object> buildPayloadWithInstallation(long installationId) {
        Map<String, Object> installation = new HashMap<>();
        installation.put("id", installationId);

        Map<String, Object> payload = new HashMap<>();
        payload.put("action", "opened");
        payload.put("installation", installation);
        return payload;
    }
}
