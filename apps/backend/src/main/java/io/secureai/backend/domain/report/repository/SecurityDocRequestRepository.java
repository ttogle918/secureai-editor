package io.secureai.backend.domain.report.repository;

import io.secureai.backend.domain.report.entity.SecurityDocRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface SecurityDocRequestRepository extends JpaRepository<SecurityDocRequest, UUID> {

    /** 요청자 본인 소유 확인을 포함한 조회 */
    Optional<SecurityDocRequest> findByIdAndRequestedById(UUID id, UUID requestedById);

    /** 다운로드 토큰으로 조회 — 토큰 자체가 인증 수단이므로 사용자 검증 불필요 */
    Optional<SecurityDocRequest> findByDownloadToken(String downloadToken);
}
