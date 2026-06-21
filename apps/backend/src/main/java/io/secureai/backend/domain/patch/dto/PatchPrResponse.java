package io.secureai.backend.domain.patch.dto;

/**
 * 패치 PR 생성 응답 DTO.
 *
 * prUrl: 생성된 GitHub PR URL
 * prNumber: PR 번호
 * branchName: 생성된 브랜치명 (secureai/patch-{short})
 */
public record PatchPrResponse(
        String prUrl,
        int prNumber,
        String branchName
) {}
