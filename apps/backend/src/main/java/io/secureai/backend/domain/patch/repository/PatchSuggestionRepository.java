package io.secureai.backend.domain.patch.repository;

import io.secureai.backend.domain.patch.entity.PatchSuggestion;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PatchSuggestionRepository extends JpaRepository<PatchSuggestion, UUID> {

    List<PatchSuggestion> findBySession_Id(UUID sessionId);

    Optional<PatchSuggestion> findByVulnerability_Id(UUID vulnId);

    /**
     * AI Engine 컨텍스트 조회 — 이전 성공 패치 예시 조회.
     * 파일 경로의 확장자를 통해 언어를 필터링한다.
     * 파라미터 바인딩(JPQL :vulnType, :langSuffix)을 사용하므로 SQL Injection 위험이 없다.
     *
     * @param vulnType   취약점 유형 (SQL_INJECTION 등)
     * @param langSuffix 파일 확장자 포함 접미사 (예: ".java", ".py")
     * @param pageable   최대 반환 건수 제한 (LIMIT 3 권장)
     */
    @Query("""
        SELECT p FROM PatchSuggestion p
        WHERE p.vulnType = :vulnType
          AND p.filePath LIKE :langSuffix
        ORDER BY p.createdAt DESC
        """)
    List<PatchSuggestion> findRecentByVulnTypeAndLangSuffix(
            @Param("vulnType") String vulnType,
            @Param("langSuffix") String langSuffix,
            Pageable pageable);
}
