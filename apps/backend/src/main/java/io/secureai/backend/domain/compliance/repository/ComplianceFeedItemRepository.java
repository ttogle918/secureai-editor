package io.secureai.backend.domain.compliance.repository;

import io.secureai.backend.domain.compliance.entity.ComplianceFeedItem;
import io.secureai.backend.domain.compliance.entity.FeedSection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

/**
 * 컴플라이언스 피드 아이템 리포지토리.
 *
 * <p>도메인 격리 원칙: 이 리포지토리는 compliance 도메인 내에서만 직접 주입한다.
 * 타 도메인에서 피드 데이터가 필요한 경우 {@code ComplianceFeedService} 를 경유한다.
 */
public interface ComplianceFeedItemRepository extends JpaRepository<ComplianceFeedItem, UUID> {

    /**
     * 특정 섹션의 피드 아이템을 게시일 내림차순, 정렬순서 오름차순으로 반환한다.
     *
     * <p>SQL 인젝션 방지: :section 파라미터 바인딩 사용 (Raw String 쿼리 조립 금지).
     *
     * @param section 조회할 섹션
     * @return 정렬된 피드 아이템 목록 (없으면 빈 목록)
     */
    @Query("""
            SELECT i FROM ComplianceFeedItem i
             WHERE i.section = :section
             ORDER BY i.publishedDate DESC, i.sortOrder ASC
            """)
    List<ComplianceFeedItem> findBySection(@Param("section") FeedSection section);
}
