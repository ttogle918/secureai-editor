package io.secureai.backend.domain.analysis.repository;

import io.secureai.backend.domain.analysis.entity.Vulnerability;
import io.secureai.backend.domain.project.repository.ProjectRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;

import java.lang.reflect.Method;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * N+1 쿼리 방지 어노테이션 적용 여부를 리플렉션으로 검증.
 * 실제 DB 없이 순수 단위 테스트로 설계 의도(EntityGraph/BatchSize 적용)를 보장한다.
 */
class AnalysisRepositoryNPlusOneTest {

    @Test
    @DisplayName("ProjectRepository — findAllAccessibleByUser에 @EntityGraph(owner) 적용 확인")
    void projectRepository_findAllAccessibleByUser_hasEntityGraph() throws Exception {
        Method method = ProjectRepository.class.getMethod(
                "findAllAccessibleByUser", UUID.class, org.springframework.data.domain.Pageable.class);
        EntityGraph annotation = method.getAnnotation(EntityGraph.class);

        assertThat(annotation).as("@EntityGraph가 findAllAccessibleByUser에 없습니다").isNotNull();
        assertThat(annotation.attributePaths()).contains("owner");
    }

    @Test
    @DisplayName("VulnerabilityRepository — findBySessionId에 @EntityGraph(session, project) 적용 확인")
    void vulnerabilityRepository_findBySessionId_hasEntityGraph() throws Exception {
        Method method = VulnerabilityRepository.class.getMethod(
                "findBySessionId", UUID.class, Pageable.class);
        EntityGraph annotation = method.getAnnotation(EntityGraph.class);

        assertThat(annotation).as("@EntityGraph가 findBySessionId에 없습니다").isNotNull();
        assertThat(annotation.attributePaths())
                .as("session과 project가 attributePaths에 포함되어야 합니다")
                .contains("session", "project");
    }

    @Test
    @DisplayName("VulnerabilityRepository — findByProjectId에 @EntityGraph 적용 확인")
    void vulnerabilityRepository_findByProjectId_hasEntityGraph() throws Exception {
        Method method = VulnerabilityRepository.class.getMethod(
                "findByProjectId", UUID.class, Pageable.class);
        EntityGraph annotation = method.getAnnotation(EntityGraph.class);

        assertThat(annotation).as("@EntityGraph가 findByProjectId에 없습니다").isNotNull();
    }

    @Test
    @DisplayName("AnalysisSessionRepository — findByProjectIdOrderByCreatedAtDesc에 @EntityGraph 적용 확인")
    void analysisSessionRepository_findByProjectId_hasEntityGraph() throws Exception {
        Method method = AnalysisSessionRepository.class.getMethod(
                "findByProjectIdOrderByCreatedAtDesc", UUID.class, Pageable.class);
        EntityGraph annotation = method.getAnnotation(EntityGraph.class);

        assertThat(annotation).as("@EntityGraph가 findByProjectIdOrderByCreatedAtDesc에 없습니다").isNotNull();
        assertThat(annotation.attributePaths())
                .as("project와 user가 attributePaths에 포함되어야 합니다")
                .contains("project", "user");
    }

    @Test
    @DisplayName("Project 엔티티 — teamMembers 컬렉션에 @BatchSize 적용 확인")
    void project_teamMembers_hasBatchSize() throws Exception {
        var field = io.secureai.backend.domain.project.entity.Project.class
                .getDeclaredField("teamMembers");
        var batchSize = field.getAnnotation(org.hibernate.annotations.BatchSize.class);

        assertThat(batchSize).as("@BatchSize가 teamMembers 필드에 없습니다").isNotNull();
        assertThat(batchSize.size())
                .as("@BatchSize.size가 0보다 커야 합니다")
                .isGreaterThan(0);
    }
}
