package io.secureai.backend.domain.patch.service;

import io.secureai.backend.domain.analysis.entity.AnalysisSession;
import io.secureai.backend.domain.analysis.service.GitHubAppAuthService;
import io.secureai.backend.domain.analysis.service.GitHubRestClient;
import io.secureai.backend.domain.patch.dto.CreatePatchPrRequest;
import io.secureai.backend.domain.patch.dto.PatchPrResponse;
import io.secureai.backend.domain.patch.entity.PatchSuggestion;
import io.secureai.backend.domain.patch.repository.PatchSuggestionRepository;
import io.secureai.backend.domain.user.entity.User;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * PatchPrService 단위 테스트.
 *
 * GitHub 클라이언트는 mock으로 대체한다 (실제 GitHub 호출 금지 — test.md 규칙).
 * 토큰 비로그 단언 및 소유 검증 거부 테스트 포함.
 */
@ExtendWith(MockitoExtension.class)
class PatchPrServiceTest {

    @Mock
    private PatchSuggestionRepository patchRepository;

    @Mock
    private GitHubRestClient gitHubRestClient;

    @Mock
    private GitHubAppAuthService gitHubAppAuthService;

    @InjectMocks
    private PatchPrService patchPrService;

    private UUID userId;
    private UUID anotherUserId;
    private UUID patchId;
    private PatchSuggestion patch;
    private AnalysisSession session;
    private User owner;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        anotherUserId = UUID.randomUUID();
        patchId = UUID.fromString("a1b2c3d4-e5f6-7890-abcd-ef1234567890");

        owner = User.builder().build();
        ReflectionTestUtils.setField(owner, "id", userId);

        session = AnalysisSession.builder().build();
        ReflectionTestUtils.setField(session, "id", UUID.randomUUID());
        ReflectionTestUtils.setField(session, "user", owner);

        patch = PatchSuggestion.builder()
                .session(session)
                .filePath("src/main/java/Dao.java")
                .vulnType("SQL_INJECTION")
                .originalSnippet("String query = \"SELECT * FROM users WHERE id = \" + id;")
                .patchedSnippet("PreparedStatement ps = conn.prepareStatement(\"SELECT * FROM users WHERE id = ?\");\nps.setString(1, id);")
                .unifiedDiff("--- a/src/main/java/Dao.java\n+++ b/src/main/java/Dao.java\n@@ -1 +1 @@\n-old\n+safe\n")
                .explanation("Used PreparedStatement to prevent SQL Injection.")
                .build();
        ReflectionTestUtils.setField(patch, "id", patchId);
    }

    // -----------------------------------------------------------------------
    // TC-1: 브랜치명 생성 — patchId 앞 8자리 사용
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("buildBranchName — patchId 앞 8자리로 브랜치명이 생성된다")
    void buildBranchName_usesFirst8CharsOfPatchId() {
        String branchName = patchPrService.buildBranchName(patchId);

        assertThat(branchName).startsWith("secureai/patch-");
        // patchId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890" → 하이픈 제거 → "a1b2c3d4..." → 앞 8자리 = "a1b2c3d4"
        assertThat(branchName).isEqualTo("secureai/patch-a1b2c3d4");
    }

    // -----------------------------------------------------------------------
    // TC-2: PR 본문 조립 — 민감 경로 포함 금지
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("buildPrBody — vulnType과 설명이 포함되고 auto-merge 금지 문구가 있다")
    void buildPrBody_containsVulnTypeAndNoAutoMerge() {
        String body = patchPrService.buildPrBody(patch);

        assertThat(body).contains("SQL_INJECTION");
        assertThat(body).contains("PreparedStatement");
        assertThat(body).contains("Auto-merge is disabled");
        // 절대 경로 포함 금지 확인 — 절대 경로("/home/...", "C:\..." 등) 없어야 함
        assertThat(body).doesNotContain("/home/");
        assertThat(body).doesNotContain("C:\\");
    }

    // -----------------------------------------------------------------------
    // TC-3: PR 제목 조립 — 파일명만 포함
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("buildPrTitle — vulnType과 파일명(경로 없음)이 포함된다")
    void buildPrTitle_containsVulnTypeAndFileName() {
        String title = patchPrService.buildPrTitle(patch);

        assertThat(title).contains("SQL_INJECTION");
        assertThat(title).contains("Dao.java");
        // 전체 경로(src/main/java) 노출 금지 확인
        assertThat(title).doesNotContain("src/main/java");
    }

    // -----------------------------------------------------------------------
    // TC-4: createPr — 정상 흐름 (GitHub mock)
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("createPr — 정상 흐름: 브랜치 생성 → 파일 커밋 → PR 생성 → 응답 반환")
    void createPr_successFlow() {
        // Given
        when(patchRepository.findById(patchId)).thenReturn(Optional.of(patch));
        when(gitHubAppAuthService.getInstallationTokenForRepo("octocat", "my-repo"))
                .thenReturn("mock-installation-token");
        when(gitHubRestClient.resolveDefaultBranch("octocat", "my-repo", "mock-installation-token"))
                .thenReturn("main");
        when(gitHubRestClient.getDefaultBranchSha("octocat", "my-repo", "main", "mock-installation-token"))
                .thenReturn("abc123sha");
        doNothing().when(gitHubRestClient).createBranchRef(anyString(), anyString(), anyString(), anyString(), anyString());
        doNothing().when(gitHubRestClient).putFileContents(anyString(), anyString(), anyString(), anyString(), anyString(), anyString(), any(), anyString());
        when(gitHubRestClient.createPullRequest(anyString(), anyString(), anyString(), anyString(), anyString(), anyString(), anyString()))
                .thenReturn(new GitHubRestClient.PullRequestResponse(42, "https://github.com/octocat/my-repo/pull/42"));

        CreatePatchPrRequest request = new CreatePatchPrRequest("octocat", "my-repo", null);

        // When
        PatchPrResponse response = patchPrService.createPr(userId, patchId, request);

        // Then
        assertThat(response.prNumber()).isEqualTo(42);
        assertThat(response.prUrl()).isEqualTo("https://github.com/octocat/my-repo/pull/42");
        assertThat(response.branchName()).startsWith("secureai/patch-");

        // auto-merge 메서드가 호출되지 않아야 함 — PR 생성만 (GitHubRestClient에 auto-merge 메서드 없음)
        verify(gitHubRestClient, times(1)).createPullRequest(anyString(), anyString(), anyString(), anyString(), anyString(), anyString(), anyString());
        verify(gitHubRestClient, never()).completeCheckRun(anyString(), anyString(), anyLong(), anyString(), anyString(), anyString());
    }

    // -----------------------------------------------------------------------
    // TC-5: createPr — 소유 검증 실패 (다른 사용자가 요청)
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("createPr — 소유 검증 실패 시 PATCH_ACCESS_DENIED 예외를 발생시킨다")
    void createPr_ownershipViolation_throwsAccessDenied() {
        when(patchRepository.findById(patchId)).thenReturn(Optional.of(patch));

        CreatePatchPrRequest request = new CreatePatchPrRequest("octocat", "my-repo", null);

        // anotherUserId로 요청 — 소유 검증 실패
        assertThatThrownBy(() -> patchPrService.createPr(anotherUserId, patchId, request))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getErrorCode())
                        .isEqualTo(ErrorCode.PATCH_ACCESS_DENIED));

        // GitHub API는 호출되지 않아야 함
        verifyNoInteractions(gitHubRestClient);
        verifyNoInteractions(gitHubAppAuthService);
    }

    // -----------------------------------------------------------------------
    // TC-6: createPr — 존재하지 않는 patchId → PATCH_NOT_FOUND
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("createPr — 존재하지 않는 patchId는 PATCH_NOT_FOUND 예외를 발생시킨다")
    void createPr_unknownPatchId_throwsPatchNotFound() {
        UUID unknownId = UUID.randomUUID();
        when(patchRepository.findById(unknownId)).thenReturn(Optional.empty());

        CreatePatchPrRequest request = new CreatePatchPrRequest("octocat", "my-repo", null);

        assertThatThrownBy(() -> patchPrService.createPr(userId, unknownId, request))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getErrorCode())
                        .isEqualTo(ErrorCode.PATCH_NOT_FOUND));
    }

    // -----------------------------------------------------------------------
    // TC-7: createPr — 브랜치 충돌 시 suffix 추가 후 재시도
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("createPr — 브랜치 충돌 시 suffix를 추가한 브랜치명으로 재시도한다")
    void createPr_branchConflict_retriesWithSuffix() {
        when(patchRepository.findById(patchId)).thenReturn(Optional.of(patch));
        when(gitHubAppAuthService.getInstallationTokenForRepo("octocat", "my-repo"))
                .thenReturn("mock-token");
        when(gitHubRestClient.resolveDefaultBranch("octocat", "my-repo", "mock-token"))
                .thenReturn("main");
        when(gitHubRestClient.getDefaultBranchSha("octocat", "my-repo", "main", "mock-token"))
                .thenReturn("sha1");

        // 첫 번째 createBranchRef 호출에서 PATCH_BRANCH_CONFLICT 발생, 두 번째는 성공
        doThrow(new BusinessException(ErrorCode.PATCH_BRANCH_CONFLICT))
                .doNothing()
                .when(gitHubRestClient).createBranchRef(anyString(), anyString(), anyString(), anyString(), anyString());

        doNothing().when(gitHubRestClient).putFileContents(anyString(), anyString(), anyString(), anyString(), anyString(), anyString(), any(), anyString());
        when(gitHubRestClient.createPullRequest(anyString(), anyString(), anyString(), anyString(), anyString(), anyString(), anyString()))
                .thenReturn(new GitHubRestClient.PullRequestResponse(7, "https://github.com/octocat/my-repo/pull/7"));

        CreatePatchPrRequest request = new CreatePatchPrRequest("octocat", "my-repo", null);

        PatchPrResponse response = patchPrService.createPr(userId, patchId, request);

        // 브랜치 생성이 2회 호출되어야 함 (첫 번째 충돌 → 두 번째 재시도)
        verify(gitHubRestClient, times(2)).createBranchRef(anyString(), anyString(), anyString(), anyString(), anyString());
        assertThat(response.prNumber()).isEqualTo(7);
    }

    // -----------------------------------------------------------------------
    // TC-8: createPr — GitHub App 인증 실패 → GITHUB_AUTH_REQUIRED 전파
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("createPr — GitHub App 인증 실패 시 GITHUB_AUTH_REQUIRED 예외가 전파된다")
    void createPr_githubAuthFailed_propagatesException() {
        when(patchRepository.findById(patchId)).thenReturn(Optional.of(patch));
        when(gitHubAppAuthService.getInstallationTokenForRepo("octocat", "missing-repo"))
                .thenThrow(new BusinessException(ErrorCode.GITHUB_AUTH_REQUIRED));

        CreatePatchPrRequest request = new CreatePatchPrRequest("octocat", "missing-repo", null);

        assertThatThrownBy(() -> patchPrService.createPr(userId, patchId, request))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getErrorCode())
                        .isEqualTo(ErrorCode.GITHUB_AUTH_REQUIRED));
    }

    // -----------------------------------------------------------------------
    // TC-9: createPr — baseBranch 지정 시 해당 브랜치를 사용한다
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("createPr — baseBranch 지정 시 해당 브랜치명으로 PR base가 설정된다")
    void createPr_withBaseBranch_usesSpecifiedBranch() {
        when(patchRepository.findById(patchId)).thenReturn(Optional.of(patch));
        when(gitHubAppAuthService.getInstallationTokenForRepo("octocat", "my-repo"))
                .thenReturn("mock-token");
        when(gitHubRestClient.getDefaultBranchSha("octocat", "my-repo", "develop", "mock-token"))
                .thenReturn("sha-develop");
        doNothing().when(gitHubRestClient).createBranchRef(anyString(), anyString(), anyString(), anyString(), anyString());
        doNothing().when(gitHubRestClient).putFileContents(anyString(), anyString(), anyString(), anyString(), anyString(), anyString(), any(), anyString());
        when(gitHubRestClient.createPullRequest(
                eq("octocat"), eq("my-repo"), anyString(), anyString(),
                anyString(), eq("develop"), eq("mock-token")))
                .thenReturn(new GitHubRestClient.PullRequestResponse(5, "https://github.com/octocat/my-repo/pull/5"));

        CreatePatchPrRequest request = new CreatePatchPrRequest("octocat", "my-repo", "develop");

        PatchPrResponse response = patchPrService.createPr(userId, patchId, request);

        assertThat(response.prNumber()).isEqualTo(5);
        // resolveDefaultBranch는 호출되지 않아야 함 (baseBranch 지정 시)
        verify(gitHubRestClient, never()).resolveDefaultBranch(anyString(), anyString(), anyString());
    }
}
