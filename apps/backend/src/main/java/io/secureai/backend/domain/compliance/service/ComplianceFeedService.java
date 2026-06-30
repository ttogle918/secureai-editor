package io.secureai.backend.domain.compliance.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.secureai.backend.domain.compliance.dto.ComplianceFeedResponse;
import io.secureai.backend.domain.compliance.entity.ComplianceFeedItem;
import io.secureai.backend.domain.compliance.entity.FeedSection;
import io.secureai.backend.domain.compliance.repository.ComplianceFeedItemRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 컴플라이언스 외부 피드 조회 서비스.
 *
 * <p>정부 권장사항·보안 뉴스·기관 게시물을 DB에서 읽어 섹션별로 그룹화한 응답을 반환한다.
 * {@link ComplianceMappingService}(OWASP 프레임워크 매핑)와 완전 독립된 기능이다.
 *
 * <p>개별 아이템 files JSONB 파싱 실패 시 전체 피드 반환을 중단하지 않는다 (skip &amp; log 원칙).
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ComplianceFeedService {

    private final ComplianceFeedItemRepository repository;
    private final ObjectMapper objectMapper;

    /**
     * 전체 피드를 섹션별로 그룹화하여 반환한다.
     *
     * <p>각 섹션은 published_date DESC, sort_order ASC 순으로 정렬된다.
     * 테이블이 비어 있으면 각 섹션이 빈 배열인 응답을 반환한다.
     *
     * @return 그룹화된 피드 응답
     */
    public ComplianceFeedResponse getFeed() {
        return new ComplianceFeedResponse(
                toItemDtos(repository.findBySection(FeedSection.GOV_RECOMMENDATION)),
                toItemDtos(repository.findBySection(FeedSection.SECURITY_NEWS)),
                toItemDtos(repository.findBySection(FeedSection.AGENCY_POST))
        );
    }

    private List<ComplianceFeedResponse.FeedItemDto> toItemDtos(List<ComplianceFeedItem> items) {
        return items.stream().map(this::toItemDto).toList();
    }

    private ComplianceFeedResponse.FeedItemDto toItemDto(ComplianceFeedItem item) {
        return new ComplianceFeedResponse.FeedItemDto(
                item.getId(),
                item.getAgency(),
                item.getCategory(),
                item.getSource(),
                item.getTitle(),
                item.getSummary(),
                item.getSourceUrl(),
                item.getPublishedDate(),
                parseFiles(item.getFiles()),
                item.getSortOrder()
        );
    }

    /**
     * JSONB 문자열을 FileAttachmentDto 목록으로 변환한다.
     *
     * <p>파싱 실패 시 전체 피드 반환을 중단하지 않고 빈 목록을 반환한다.
     * 민감 정보를 포함하지 않으므로 파싱 실패 메시지만 WARN 레벨로 기록한다.
     */
    private List<ComplianceFeedResponse.FileAttachmentDto> parseFiles(String filesJson) {
        if (filesJson == null || filesJson.isBlank() || "[]".equals(filesJson.trim())) {
            return List.of();
        }
        try {
            return objectMapper.readValue(filesJson,
                    new TypeReference<List<ComplianceFeedResponse.FileAttachmentDto>>() {});
        } catch (JsonProcessingException e) {
            log.warn("[compliance-feed] files JSONB 파싱 실패 — 빈 목록 반환: {}", e.getMessage());
            return List.of();
        }
    }
}
