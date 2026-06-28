package io.secureai.backend.domain.report.repository;

import io.secureai.backend.domain.report.entity.SecurityDocRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface SecurityDocRequestRepository extends JpaRepository<SecurityDocRequest, UUID> {

    /** 요청자 본인 소유 확인을 포함한 조회 */
    Optional<SecurityDocRequest> findByIdAndRequestedById(UUID id, UUID requestedById);

    /**
     * 비동기 생성 처리용 — project를 JOIN FETCH 한다.
     * @Async 스레드에는 영속성 컨텍스트가 없어 lazy 프록시(project.getName 등) 접근 시
     * LazyInitializationException 이 발생하므로 미리 초기화한다.
     */
    @Query("SELECT r FROM SecurityDocRequest r JOIN FETCH r.project WHERE r.id = :id")
    Optional<SecurityDocRequest> findWithProjectById(@Param("id") UUID id);

    /** 다운로드 토큰으로 조회 — 토큰 자체가 인증 수단이므로 사용자 검증 불필요 */
    Optional<SecurityDocRequest> findByDownloadToken(String downloadToken);
}
