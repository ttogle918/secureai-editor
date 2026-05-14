package io.secureai.backend.domain.analysis.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

/**
 * 커밋 히스토리 시크릿 스캔 요청 DTO.
 *
 * AI Engine POST /agent/scan-commits 로 전달된다.
 */
public record CommitScanRequest(
        @NotBlank String owner,
        @NotBlank String repo,
        String ref,                   // branch/tag/commit — nullable (기본 브랜치 사용)
        @Min(1) @Max(100) int perPage,
        String preferredModel,        // BYOK 모델 override — nullable
        String userApiKey             // BYOK 사용자 API 키 — 로그 출력 금지
) {
    /** perPage 기본값 30 적용 생성자. */
    public static CommitScanRequest of(String owner, String repo, String ref) {
        return new CommitScanRequest(owner, repo, ref, 30, null, null);
    }
}
