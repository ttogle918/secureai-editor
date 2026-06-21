package io.secureai.backend.domain.patch.service;

import io.secureai.backend.domain.analysis.service.GitHubAppAuthService;
import io.secureai.backend.domain.analysis.service.GitHubRestClient;
import io.secureai.backend.domain.patch.dto.CreatePatchPrRequest;
import io.secureai.backend.domain.patch.dto.PatchPrResponse;
import io.secureai.backend.domain.patch.entity.PatchSuggestion;
import io.secureai.backend.domain.patch.repository.PatchSuggestionRepository;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * 패치 PR 생성 서비스.
 *
 * 책임 (SRP):
 * - patchId 소유 검증 → Installation Token 교환 → 브랜치 생성 → 파일 커밋 → PR 오픈 → PR 코멘트
 *
 * 의존 (DIP):
 * - GitHubRestClient (HTTP 통신)
 * - GitHubAppAuthService (App JWT / Installation Token)
 * - PatchSuggestionRepository (패치 조회)
 *
 * 보안 불변식:
 * - appToken, installationToken 절대 로그 출력 금지
 * - auto-merge 절대 금지 (PR-only 정책)
 * - PR 본문·브랜치명에 민감 경로/페이로드 포함 금지
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PatchPrService {

    /** 브랜치 prefix. 매직 문자열 상수화 */
    private static final String BRANCH_PREFIX = "secureai/patch-";
    /** patchId short suffix 길이 (UUID 앞 8자) */
    private static final int PATCH_ID_SHORT_LENGTH = 8;
    /** PR 제목 */
    private static final String PR_TITLE_TEMPLATE = "[SecureAI] Fix %s vulnerability in %s";
    /** 커밋 메시지 */
    private static final String COMMIT_MESSAGE_TEMPLATE = "fix: apply SecureAI patch for %s";

    private final PatchSuggestionRepository patchRepository;
    private final GitHubRestClient gitHubRestClient;
    private final GitHubAppAuthService gitHubAppAuthService;

    /**
     * 패치를 GitHub 브랜치에 커밋하고 PR을 생성한다.
     *
     * 흐름:
     * 1. patchId 조회 + 소유 검증 (요청자 userId와 세션의 userId 비교)
     * 2. GitHub App Installation Token 취득 (레포 기반)
     * 3. base HEAD SHA 조회 (baseBranch 또는 기본 브랜치)
     * 4. secureai/patch-{short} 브랜치 ref 생성
     * 5. patchedSnippet/unifiedDiff → 파일 커밋 (putFileContents)
     * 6. PR 생성 (auto-merge 절대 금지)
     * 7. PR 코멘트 — 패치 설명 (민감 정보 제외)
     *
     * @param userId    요청자 사용자 ID (소유 검증용)
     * @param patchId   패치 제안 ID
     * @param request   PR 생성 요청 (owner, repo, baseBranch)
     * @return PatchPrResponse (prUrl, prNumber, branchName)
     */
    @Transactional(readOnly = true)
    public PatchPrResponse createPr(UUID userId, UUID patchId, CreatePatchPrRequest request) {
        // ── Step 1: 패치 조회 및 소유 검증 ─────────────────────────────────────
        PatchSuggestion patch = patchRepository.findById(patchId)
                .orElseThrow(() -> new BusinessException(ErrorCode.PATCH_NOT_FOUND));

        UUID patchOwnerId = patch.getSession().getUser().getId();
        if (!patchOwnerId.equals(userId)) {
            log.warn("[patch-pr] 소유 검증 실패 patchId={} requesterId={}", patchId, userId);
            throw new BusinessException(ErrorCode.PATCH_ACCESS_DENIED);
        }

        String owner = request.owner();
        String repo = request.repo();
        String baseBranch = (request.baseBranch() != null && !request.baseBranch().isBlank())
                ? request.baseBranch() : null;

        log.info("[patch-pr] PR 생성 시작 patchId={} owner={} repo={}", patchId, owner, repo);

        // ── Step 2: Installation Token 취득 ─────────────────────────────────────
        // appToken 로그 출력 금지
        String appToken = gitHubAppAuthService.getInstallationTokenForRepo(owner, repo);

        // ── Step 3: base HEAD SHA 조회 ───────────────────────────────────────────
        // baseBranch가 null이면 resolveDefaultBranch가 내부에서 기본 브랜치를 조회한다.
        // resolvedBase는 실제 사용할 브랜치명을 추적한다.
        String resolvedBase = (baseBranch != null && !baseBranch.isBlank()) ? baseBranch
                : resolveDefaultBranch(owner, repo, appToken);
        String headSha = gitHubRestClient.getDefaultBranchSha(owner, repo, resolvedBase, appToken);

        // ── Step 4: 브랜치 생성 ─────────────────────────────────────────────────
        String branchName = buildBranchName(patchId);
        try {
            gitHubRestClient.createBranchRef(owner, repo, branchName, headSha, appToken);
        } catch (BusinessException e) {
            if (e.getErrorCode() == ErrorCode.PATCH_BRANCH_CONFLICT) {
                // 이미 존재하는 브랜치 → suffix 추가 후 재시도
                branchName = branchName + "-" + System.currentTimeMillis() % 10000;
                log.info("[patch-pr] 브랜치 충돌 → suffix 추가 branchName={}", branchName);
                gitHubRestClient.createBranchRef(owner, repo, branchName, headSha, appToken);
            } else {
                throw e;
            }
        }

        // ── Step 5: 파일 커밋 ───────────────────────────────────────────────────
        String filePath = patch.getFilePath();
        String patchedContent = resolvePatchedContent(patch);
        String commitMessage = String.format(COMMIT_MESSAGE_TEMPLATE, patch.getVulnType());

        // 기존 파일 SHA 조회 (update 모드용). 실패하면 null(신규 파일 create 모드)
        String existingFileSha = resolveExistingFileSha(owner, repo, filePath, branchName, appToken);

        gitHubRestClient.putFileContents(
                owner, repo, filePath,
                commitMessage, patchedContent,
                branchName, existingFileSha, appToken
        );

        // ── Step 6: PR 생성 (auto-merge 절대 금지) ──────────────────────────────
        String prTitle = buildPrTitle(patch);
        String prBody = buildPrBody(patch);

        GitHubRestClient.PullRequestResponse prResponse = gitHubRestClient.createPullRequest(
                owner, repo, prTitle, prBody, branchName, resolvedBase, appToken
        );

        // ── Step 7: PR 코멘트 (패치 설명 — 민감 정보 제외) ──────────────────────
        String commentBody = buildCommentBody(patch);
        try {
            gitHubRestClient.createPrComment(owner, repo, prResponse.prNumber(), commentBody, appToken);
        } catch (Exception e) {
            // 코멘트 실패는 PR 생성 성공에 영향 없음 (skip & log)
            log.warn("[patch-pr] PR 코멘트 생성 실패 (비치명) prNumber={} err={}", prResponse.prNumber(), e.getMessage());
        }

        log.info("[patch-pr] PR 생성 완료 patchId={} prNumber={}", patchId, prResponse.prNumber());
        return new PatchPrResponse(prResponse.prUrl(), prResponse.prNumber(), branchName);
    }

    // ─── Private Helpers ──────────────────────────────────────────────────────

    /**
     * 브랜치명을 생성한다. patchId의 앞 8자리를 사용한다.
     * 브랜치명에 민감 경로/페이로드 포함 금지.
     */
    String buildBranchName(UUID patchId) {
        String shortId = patchId.toString().replace("-", "").substring(0, PATCH_ID_SHORT_LENGTH);
        return BRANCH_PREFIX + shortId;
    }

    /**
     * PR 제목을 조립한다. 민감 정보 포함 금지.
     */
    String buildPrTitle(PatchSuggestion patch) {
        // filePath에서 파일명만 추출 (경로 전체 노출 최소화)
        String fileName = extractFileName(patch.getFilePath());
        return String.format(PR_TITLE_TEMPLATE, patch.getVulnType(), fileName);
    }

    /**
     * PR 본문을 조립한다. 민감 경로/페이로드 포함 금지.
     */
    String buildPrBody(PatchSuggestion patch) {
        StringBuilder sb = new StringBuilder();
        sb.append("## SecureAI Auto-Generated Security Patch\n\n");
        sb.append("**Vulnerability Type:** ").append(patch.getVulnType()).append("\n\n");
        sb.append("**File:** `").append(sanitizePath(patch.getFilePath())).append("`\n\n");
        if (patch.getExplanation() != null && !patch.getExplanation().isBlank()) {
            sb.append("**Explanation:**\n").append(patch.getExplanation()).append("\n\n");
        }
        sb.append("---\n");
        sb.append("> This PR was automatically generated by SecureAI. ");
        sb.append("**Please review before merging.** Auto-merge is disabled.\n");
        return sb.toString();
    }

    /**
     * PR 코멘트 본문을 조립한다.
     */
    private String buildCommentBody(PatchSuggestion patch) {
        StringBuilder sb = new StringBuilder();
        sb.append("### SecureAI Patch Details\n\n");
        sb.append("**Vulnerability:** ").append(patch.getVulnType()).append("\n\n");
        if (patch.getExplanation() != null && !patch.getExplanation().isBlank()) {
            sb.append("**Explanation:** ").append(patch.getExplanation()).append("\n\n");
        }
        sb.append("> Review this patch carefully before approving. ");
        sb.append("This is a suggested fix — human review is required.");
        return sb.toString();
    }

    /**
     * 패치된 파일 내용을 결정한다.
     * patchedSnippet 우선, 없으면 unifiedDiff 사용.
     */
    private String resolvePatchedContent(PatchSuggestion patch) {
        if (patch.getPatchedSnippet() != null && !patch.getPatchedSnippet().isBlank()) {
            return patch.getPatchedSnippet();
        }
        if (patch.getUnifiedDiff() != null && !patch.getUnifiedDiff().isBlank()) {
            return patch.getUnifiedDiff();
        }
        throw new BusinessException(ErrorCode.PATCH_NOT_FOUND,
                "패치 내용(patchedSnippet/unifiedDiff)이 없습니다.");
    }

    /**
     * 기존 파일 SHA를 조회한다.
     *
     * GitHubRestClient에 파일 SHA 전용 메서드가 없으므로 null을 반환(신규 파일 create 모드).
     * 기존 파일이면 GitHub API가 409를 반환하고 PATCH_BRANCH_CONFLICT 예외가 발생한다.
     * Stage 2(TASK-1402) 또는 후속 스프린트에서 getFileSha 메서드 추가 예정.
     *
     * @return null (신규 파일 create 모드)
     */
    private String resolveExistingFileSha(String owner, String repo, String filePath,
                                          String branch, String appToken) {
        // 현재 GitHubRestClient에는 파일 SHA 단독 조회 메서드가 없음 (신규 파일 create 모드)
        // 기존 파일 update 시 GitHub API 409 → PATCH_BRANCH_CONFLICT 처리됨
        return null;
    }

    /**
     * 레포지토리의 기본 브랜치명을 조회한다.
     * GitHubRestClient에 위임한다 (DIP 준수).
     */
    private String resolveDefaultBranch(String owner, String repo, String appToken) {
        return gitHubRestClient.resolveDefaultBranch(owner, repo, appToken);
    }

    /**
     * 파일 경로에서 파일명만 추출한다.
     */
    private String extractFileName(String filePath) {
        if (filePath == null || filePath.isBlank()) return "unknown";
        int lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
        return lastSlash >= 0 ? filePath.substring(lastSlash + 1) : filePath;
    }

    /**
     * 파일 경로를 안전하게 노출한다. 절대 경로 → 상대 경로로 변환.
     * PR 본문에 민감 절대 경로 노출 방지.
     */
    private String sanitizePath(String filePath) {
        if (filePath == null) return "";
        // 절대 경로 제거 — src/ 이후 경로만 노출
        int srcIdx = filePath.indexOf("src/");
        if (srcIdx >= 0) return filePath.substring(srcIdx);
        return extractFileName(filePath);
    }
}
