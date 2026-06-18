package io.secureai.backend.domain.analysis.repository;

import io.secureai.backend.domain.analysis.entity.TriageFeedback;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

/**
 * 트리아지 피드백 저장소 — append-only.
 *
 * <p>이 Repository는 save(insert)만 허용한다.
 * deleteById, deleteAll 등은 호출하지 않는다(애플리케이션 정책).
 */
public interface TriageFeedbackRepository extends JpaRepository<TriageFeedback, UUID> {

    /** 취약점별 피드백 이력 수 — 이력 누적 확인용 */
    long countByVulnerabilityId(UUID vulnerabilityId);
}
