package io.secureai.backend.domain.patch.dto;

/**
 * AI Engine 컨텍스트 조회용 이전 패치 예시 단위.
 * GET /api/v1/internal/projects/{projectId}/patch-examples 응답 항목.
 *
 * @param originalSnippet 패치 전 코드 스니펫
 * @param patchedSnippet  패치 후 코드 스니펫
 * @param explanation     패치 설명 (nullable)
 */
public record PatchExampleItem(
        String originalSnippet,
        String patchedSnippet,
        String explanation
) {}
