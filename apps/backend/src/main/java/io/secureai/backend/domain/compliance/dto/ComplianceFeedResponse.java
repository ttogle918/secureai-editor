package io.secureai.backend.domain.compliance.dto;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * GET /api/v1/compliance/feed 응답 DTO.
 *
 * <p>외부 피드 3개 섹션을 그룹화하여 반환한다.
 * 보안 점검 체크리스트(CHECKLIST)는 프론트엔드에서 정적으로 유지한다.
 *
 * <p>{@code content} (RAG 원문 전체)는 응답에 포함하지 않는다 — Stage B 전용 필드.
 */
public record ComplianceFeedResponse(
        List<FeedItemDto> govRecommendations,
        List<FeedItemDto> securityNews,
        List<FeedItemDto> agencyPosts
) {

    /**
     * 개별 피드 아이템 DTO.
     *
     * <p>{@code publishedDate}: LocalDate → ISO-8601 날짜 문자열 ("YYYY-MM-DD")로 직렬화.
     * {@code files}: 첨부파일 메타데이터 목록 (Stage A 에서는 빈 배열).
     */
    public record FeedItemDto(
            UUID id,
            String agency,
            String category,
            String source,
            String title,
            String summary,
            String sourceUrl,
            LocalDate publishedDate,
            List<FileAttachmentDto> files,
            int sortOrder
    ) {}

    /**
     * 첨부파일 메타데이터 DTO.
     * 실제 파일은 서버에 저장하지 않고 {@code sourceUrl} 링크로 안내한다.
     */
    public record FileAttachmentDto(
            String name,
            String type,
            String size
    ) {}
}
