package io.secureai.backend.domain.analysis.service;

import io.secureai.backend.domain.user.service.UserService;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class GitHubApiServiceTest {

    @Mock UserService userService;
    @Mock GitHubRestClient gitHubRestClient;

    @InjectMocks GitHubApiService gitHubApiService;

    // ─── parseOwnerRepo 정적 메서드 ───────────────────────────────────────────

    @Test
    @DisplayName("표준 GitHub URL에서 owner와 repo를 추출한다")
    void parseOwnerRepo_standard_url() {
        String[] result = GitHubApiService.parseOwnerRepo("https://github.com/myorg/myrepo");
        assertThat(result[0]).isEqualTo("myorg");
        assertThat(result[1]).isEqualTo("myrepo");
    }

    @Test
    @DisplayName(".git 접미사가 붙은 URL에서도 정상 파싱된다")
    void parseOwnerRepo_git_suffix() {
        String[] result = GitHubApiService.parseOwnerRepo("https://github.com/myorg/myrepo.git");
        assertThat(result[0]).isEqualTo("myorg");
        assertThat(result[1]).isEqualTo("myrepo");
    }

    @Test
    @DisplayName("http:// 프로토콜 URL도 파싱된다")
    void parseOwnerRepo_http_protocol() {
        String[] result = GitHubApiService.parseOwnerRepo("http://github.com/user/project");
        assertThat(result[0]).isEqualTo("user");
        assertThat(result[1]).isEqualTo("project");
    }

    @Test
    @DisplayName("owner만 있고 repo가 없는 URL이면 INVALID_GITHUB_URL 예외가 발생한다")
    void parseOwnerRepo_missing_repo_throws() {
        assertThatThrownBy(() -> GitHubApiService.parseOwnerRepo("https://github.com/onlyowner"))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.INVALID_GITHUB_URL);
    }

    @Test
    @DisplayName("null URL이면 INVALID_GITHUB_URL 예외가 발생한다")
    void parseOwnerRepo_null_throws() {
        assertThatThrownBy(() -> GitHubApiService.parseOwnerRepo(null))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.INVALID_GITHUB_URL);
    }

    @Test
    @DisplayName("빈 문자열 URL이면 INVALID_GITHUB_URL 예외가 발생한다")
    void parseOwnerRepo_empty_throws() {
        assertThatThrownBy(() -> GitHubApiService.parseOwnerRepo(""))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.INVALID_GITHUB_URL);
    }

    // ─── resolveAndValidate ───────────────────────────────────────────────────

    @Test
    @DisplayName("GitHub 토큰이 있으면 validateRepoAccess가 호출된다")
    void resolveAndValidate_with_token_calls_validate() {
        UUID userId = UUID.randomUUID();
        when(userService.getDecryptedGithubToken(userId)).thenReturn("decrypted-token");

        GitHubApiService.GithubRepoInfo info = gitHubApiService.resolveAndValidate(
                userId, "https://github.com/owner/repo", "main");

        verify(gitHubRestClient).validateRepoAccess("owner", "repo", "decrypted-token");
        assertThat(info.owner()).isEqualTo("owner");
        assertThat(info.repo()).isEqualTo("repo");
        assertThat(info.ref()).isEqualTo("main");
        assertThat(info.token()).isEqualTo("decrypted-token");
    }

    @Test
    @DisplayName("GitHub 토큰이 없으면 validateRepoAccess가 호출되지 않는다 (공개 레포)")
    void resolveAndValidate_without_token_skips_validate() {
        UUID userId = UUID.randomUUID();
        when(userService.getDecryptedGithubToken(userId)).thenReturn(null);

        GitHubApiService.GithubRepoInfo info = gitHubApiService.resolveAndValidate(
                userId, "https://github.com/public/repo", null);

        verifyNoInteractions(gitHubRestClient);
        assertThat(info.token()).isNull();
        assertThat(info.ref()).isNull();
    }

    @Test
    @DisplayName("사용자를 찾을 수 없으면 USER_NOT_FOUND 예외가 발생한다")
    void resolveAndValidate_user_not_found_throws() {
        UUID userId = UUID.randomUUID();
        when(userService.getDecryptedGithubToken(userId))
                .thenThrow(new BusinessException(ErrorCode.USER_NOT_FOUND));

        assertThatThrownBy(() -> gitHubApiService.resolveAndValidate(
                userId, "https://github.com/owner/repo", null))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.USER_NOT_FOUND);
    }

    @Test
    @DisplayName("validateRepoAccess가 GITHUB_REPO_NOT_FOUND를 던지면 그대로 전파된다")
    void resolveAndValidate_repo_not_found_propagates() {
        UUID userId = UUID.randomUUID();
        when(userService.getDecryptedGithubToken(userId)).thenReturn("token");
        doThrow(new BusinessException(ErrorCode.GITHUB_REPO_NOT_FOUND))
                .when(gitHubRestClient).validateRepoAccess(any(), any(), any());

        assertThatThrownBy(() -> gitHubApiService.resolveAndValidate(
                userId, "https://github.com/owner/missing-repo", null))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.GITHUB_REPO_NOT_FOUND);
    }
}
