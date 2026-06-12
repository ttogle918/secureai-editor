package io.secureai.backend.domain.analysis.repository;

import io.secureai.backend.domain.analysis.entity.PrReviewHistory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PrReviewHistoryRepository extends JpaRepository<PrReviewHistory, UUID> {

    /**
     * 특정 레포지토리의 PR 번호에 대한 리뷰 이력을 조회한다.
     * 동일 PR에 여러 커밋(synchronize)이 push될 수 있으므로 List 반환.
     */
    List<PrReviewHistory> findByRepoOwnerAndRepoNameAndPrNumber(
            String repoOwner, String repoName, int prNumber
    );

    /**
     * 특정 레포지토리의 전체 PR 리뷰 이력을 조회한다.
     */
    List<PrReviewHistory> findByRepoOwnerAndRepoName(String repoOwner, String repoName);

    /**
     * AI Engine 분석 sessionId로 PR 리뷰 이력을 역조회한다.
     * Redis 완료 콜백에서 분석된 세션이 PR 웹훅 트리거인지 판별할 때 사용한다.
     * 일반 분석 세션(PR 아님)은 여기 없으므로 empty 반환 → 기존 동작 유지.
     */
    Optional<PrReviewHistory> findBySessionId(UUID sessionId);
}
