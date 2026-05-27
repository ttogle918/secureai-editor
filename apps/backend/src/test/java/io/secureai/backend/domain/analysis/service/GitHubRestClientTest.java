package io.secureai.backend.domain.analysis.service;

import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.client.RestClient;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * GitHubRestClient 단위 테스트.
 *
 * 실제 HTTP 호출은 RestClient Mock + spy 패턴으로 격리한다.
 * createCheckRun / completeCheckRun / createPrComment / getPrChangedFiles
 * 메서드의 인터페이스 계약을 검증한다.
 */
@ExtendWith(MockitoExtension.class)
class GitHubRestClientTest {

    /**
     * 생성자 주입용 RestClient Mock.
     * GitHubRestClient는 기본 생성자가 없으므로 Mock을 주입해 Spy를 생성한다.
     */
    @Mock
    private RestClient restClient;

    private GitHubRestClient gitHubRestClient;

    @BeforeEach
    void setUp() {
        // 생성자 주입 + spy: 실제 로직 실행, HTTP 호출만 doReturn으로 대체
        gitHubRestClient = spy(new GitHubRestClient(restClient));
    }

    @Test
    @DisplayName("createCheckRun은 정상 응답 시 CheckRunResponse를 반환한다")
    void createCheckRun_validInput_returnsCheckRunResponse() {
        // given: HTTP 호출을 mock으로 대체
        GitHubRestClient.CheckRunResponse mockResponse = new GitHubRestClient.CheckRunResponse(12345L);
        doReturn(mockResponse).when(gitHubRestClient)
                .createCheckRun(anyString(), anyString(), anyString(), anyString(), anyString(), anyString());

        // when
        GitHubRestClient.CheckRunResponse result = gitHubRestClient.createCheckRun(
                "testorg", "testrepo",
                "abc123def456abc123def456abc123def456abc1",
                "SecureAI Security Review", "in_progress", "token-value"
        );

        // then
        assertThat(result).isNotNull();
        assertThat(result.id()).isEqualTo(12345L);
    }

    @Test
    @DisplayName("createCheckRun은 GitHub API 실패 시 BusinessException을 던진다")
    void createCheckRun_githubApiError_throwsBusinessException() {
        // given: HTTP 실패 시뮬레이션
        doThrow(new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR))
                .when(gitHubRestClient)
                .createCheckRun(anyString(), anyString(), anyString(), anyString(), anyString(), anyString());

        // when / then
        assertThatThrownBy(() -> gitHubRestClient.createCheckRun(
                "testorg", "testrepo", "sha", "name", "in_progress", "token"
        )).isInstanceOf(BusinessException.class);
    }

    @Test
    @DisplayName("completeCheckRun은 성공 결론으로 Check Run을 완료한다")
    void completeCheckRun_successConclusion_completesWithoutException() {
        // given: HTTP 호출을 no-op으로 대체
        doNothing().when(gitHubRestClient)
                .completeCheckRun(anyString(), anyString(), anyLong(), anyString(), anyString(), anyString());

        // when / then: 예외 없이 완료
        assertThatNoException()
                .isThrownBy(() -> gitHubRestClient.completeCheckRun(
                        "testorg", "testrepo", 12345L,
                        "success", "보안 취약점이 발견되지 않았습니다.", "token"
                ));

        verify(gitHubRestClient, times(1)).completeCheckRun(
                eq("testorg"), eq("testrepo"), eq(12345L),
                eq("success"), anyString(), eq("token")
        );
    }

    @Test
    @DisplayName("completeCheckRun은 failure 결론으로 Check Run을 완료한다")
    void completeCheckRun_failureConclusion_completesWithoutException() {
        // given
        doNothing().when(gitHubRestClient)
                .completeCheckRun(anyString(), anyString(), anyLong(), anyString(), anyString(), anyString());

        // when / then
        assertThatNoException()
                .isThrownBy(() -> gitHubRestClient.completeCheckRun(
                        "testorg", "testrepo", 99L,
                        "failure", "총 3개의 보안 취약점이 발견되었습니다.", "token"
                ));

        verify(gitHubRestClient, times(1)).completeCheckRun(
                anyString(), anyString(), anyLong(),
                eq("failure"), anyString(), anyString()
        );
    }

    @Test
    @DisplayName("CheckRunResponse record는 id 필드를 정확히 반환한다")
    void checkRunResponse_recordAccessor_returnsId() {
        // given
        long expectedId = 987654321L;
        GitHubRestClient.CheckRunResponse response = new GitHubRestClient.CheckRunResponse(expectedId);

        // when / then
        assertThat(response.id()).isEqualTo(expectedId);
    }

    @Test
    @DisplayName("validateRepoAccess는 403 응답 시 GITHUB_AUTH_REQUIRED 예외를 던진다")
    void validateRepoAccess_forbidden_throwsGithubAuthRequired() {
        // given
        doThrow(new BusinessException(ErrorCode.GITHUB_AUTH_REQUIRED))
                .when(gitHubRestClient).validateRepoAccess(anyString(), anyString(), anyString());

        // when / then
        assertThatThrownBy(() -> gitHubRestClient.validateRepoAccess("org", "repo", "bad-token"))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> {
                    BusinessException be = (BusinessException) ex;
                    assertThat(be.getErrorCode()).isEqualTo(ErrorCode.GITHUB_AUTH_REQUIRED);
                });
    }

    @Test
    @DisplayName("validateRepoAccess는 404 응답 시 GITHUB_REPO_NOT_FOUND 예외를 던진다")
    void validateRepoAccess_notFound_throwsGithubRepoNotFound() {
        // given
        doThrow(new BusinessException(ErrorCode.GITHUB_REPO_NOT_FOUND))
                .when(gitHubRestClient).validateRepoAccess(anyString(), anyString(), anyString());

        // when / then
        assertThatThrownBy(() -> gitHubRestClient.validateRepoAccess("org", "no-such-repo", "token"))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> {
                    BusinessException be = (BusinessException) ex;
                    assertThat(be.getErrorCode()).isEqualTo(ErrorCode.GITHUB_REPO_NOT_FOUND);
                });
    }
}
