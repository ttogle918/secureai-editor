package io.secureai.backend.domain.cve.repository;

import io.secureai.backend.domain.cve.entity.CveData;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface CveDataRepository extends JpaRepository<CveData, String> {

    Optional<CveData> findByCveId(String cveId);

    Page<CveData> findBySeverityOrderByPublishedAtDesc(String severity, Pageable pageable);

    /**
     * affectedProducts JSONB 컬럼에서 packageName 을 포함하는 CVE 목록을 반환한다.
     *
     * JSONB 텍스트 검색 (::text ILIKE) 으로 패키지 이름이 포함된 항목을 조회한다.
     * SQL 인젝션 방지를 위해 파라미터 바인딩(:packageName)을 사용한다.
     */
    @Query(value = """
            SELECT *
              FROM cve_data
             WHERE affected_products::text ILIKE '%' || :packageName || '%'
             ORDER BY published_at DESC
            """,
            nativeQuery = true)
    List<CveData> findByPackageName(@Param("packageName") String packageName);
}
