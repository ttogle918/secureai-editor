package io.secureai.backend.domain.compliance.crawler.dto;

import java.time.LocalDate;
import java.util.List;

/**
 * 크롤러가 HTML 파싱 후 생성하는 중간 DTO.
 *
 * <p>엔티티와 분리된 이유: 파서는 네트워크·DB 없이 순수 함수로 동작해야 하며,
 * 엔티티 의존이 없어야 단위 테스트가 용이하다.
 * 오케스트레이터(ComplianceFeedCrawler)가 이 DTO를 엔티티로 변환해 저장한다.
 *
 * <p>외부 콘텐츠 원문 전체 복제 금지 — summary 필드는 요약/발췌만 허용.
 * 원문 전체는 sourceUrl 링크로 안내한다.
 */
public record CrawledFeedItemDto(
        String title,
        /** 요약 또는 발췌 (원문 전체 저장 금지). */
        String summary,
        String sourceUrl,
        LocalDate publishedDate,
        /** 본문 발췌 (필요한 경우에만). 원문 전체 저장 금지. */
        String content,
        List<FileMetaDto> files,
        String agency,
        String category,
        String source
) {
    /** 첨부파일 메타 — 실제 파일 바이너리는 저장하지 않고 메타만 수집한다. */
    public record FileMetaDto(String name, String type, String size) {}
}
