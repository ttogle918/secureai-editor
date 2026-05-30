package io.secureai.backend.domain.repository;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestFactory;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.type.filter.AssignableTypeFilter;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.SoftAssertions.assertSoftly;

/**
 * Spring Data JPA 리포지토리의 <b>쿼리 설계 의도</b>를 리플렉션으로 검증한다.
 * 실제 DB/Spring 컨텍스트 없이 순수 단위 테스트로 동작하며,
 * 클래스패스를 스캔해 새로 추가되는 리포지토리에도 자동으로 규칙을 적용한다.
 *
 * <p>검증하는 불변식:
 * <ul>
 *   <li>{@code @Modifying} 메서드는 반드시 {@code @Query}를 동반해야 한다
 *       (없으면 파생 쿼리로 해석되어 벌크 UPDATE/DELETE가 조용히 오작동).</li>
 *   <li>{@code @EntityGraph}는 비어있지 않은 attributePaths(또는 named graph)를 가져야 한다
 *       (빈 그래프는 N+1 방지 효과가 없는 no-op).</li>
 *   <li>문서화된 N+1 방지 fetch-join 계약이 회귀하지 않는다.</li>
 * </ul>
 */
class RepositoryQueryDesignTest {

    private static final String BASE_PACKAGE = "io.secureai.backend";

    /** 클래스패스를 스캔해 Spring Data Repository 인터페이스를 모두 찾는다. */
    private static List<Class<?>> findRepositoryInterfaces() {
        // 기본 isCandidateComponent(MetadataReader)는 include 필터(Repository 타입)를 적용하므로 그대로 두고,
        // 인터페이스를 제외하는 AnnotatedBeanDefinition 오버로드만 독립 인터페이스 허용으로 재정의한다.
        var provider = new ClassPathScanningCandidateComponentProvider(false) {
            @Override
            protected boolean isCandidateComponent(
                    org.springframework.beans.factory.annotation.AnnotatedBeanDefinition beanDefinition) {
                return beanDefinition.getMetadata().isInterface()
                        && beanDefinition.getMetadata().isIndependent();
            }
        };
        provider.addIncludeFilter(new AssignableTypeFilter(Repository.class));

        List<Class<?>> repositories = new ArrayList<>();
        for (BeanDefinition def : provider.findCandidateComponents(BASE_PACKAGE)) {
            try {
                Class<?> clazz = Class.forName(def.getBeanClassName());
                if (clazz.isInterface() && Repository.class.isAssignableFrom(clazz)) {
                    repositories.add(clazz);
                }
            } catch (ClassNotFoundException e) {
                throw new IllegalStateException("리포지토리 클래스 로드 실패: " + def.getBeanClassName(), e);
            }
        }
        repositories.sort(Comparator.comparing(Class::getName));
        return repositories;
    }

    @Test
    @DisplayName("스캐너 정상 동작 — 리포지토리 인터페이스를 하나 이상 발견한다")
    void scanner_findsRepositories() {
        List<Class<?>> repositories = findRepositoryInterfaces();
        assertThat(repositories)
                .as("io.secureai.backend 패키지에서 Repository 인터페이스를 찾지 못했습니다 "
                        + "(스캐너 설정 또는 컴파일 산출물 확인 필요)")
                .isNotEmpty();
    }

    @TestFactory
    @DisplayName("@Modifying 메서드는 반드시 @Query를 동반해야 한다")
    List<DynamicTest> modifyingMethodsRequireQuery() {
        List<DynamicTest> tests = new ArrayList<>();
        for (Class<?> repo : findRepositoryInterfaces()) {
            for (Method method : repo.getDeclaredMethods()) {
                if (method.isAnnotationPresent(Modifying.class)) {
                    tests.add(DynamicTest.dynamicTest(
                            repo.getSimpleName() + "#" + method.getName(),
                            () -> assertThat(method.getAnnotation(Query.class))
                                    .as("@Modifying 메서드 %s#%s 에 @Query가 없습니다 — "
                                            + "벌크 UPDATE/DELETE가 파생 쿼리로 잘못 해석됩니다",
                                            repo.getSimpleName(), method.getName())
                                    .isNotNull()));
                }
            }
        }
        return tests;
    }

    @TestFactory
    @DisplayName("@EntityGraph는 비어있지 않은 fetch 경로 또는 named graph를 가져야 한다")
    List<DynamicTest> entityGraphMustNotBeEmpty() {
        List<DynamicTest> tests = new ArrayList<>();
        for (Class<?> repo : findRepositoryInterfaces()) {
            for (Method method : repo.getDeclaredMethods()) {
                EntityGraph graph = method.getAnnotation(EntityGraph.class);
                if (graph != null) {
                    tests.add(DynamicTest.dynamicTest(
                            repo.getSimpleName() + "#" + method.getName(),
                            () -> {
                                boolean hasPaths = graph.attributePaths().length > 0;
                                boolean hasNamedGraph = graph.value() != null && !graph.value().isBlank();
                                assertThat(hasPaths || hasNamedGraph)
                                        .as("@EntityGraph on %s#%s 에 attributePaths도 named graph도 "
                                                + "지정되지 않아 N+1 방지 효과가 없습니다",
                                                repo.getSimpleName(), method.getName())
                                        .isTrue();
                            }));
                }
            }
        }
        return tests;
    }

    @Test
    @DisplayName("문서화된 N+1 방지 fetch-join 계약이 회귀하지 않는다")
    void documentedFetchJoinContracts() {
        assertSoftly(softly -> {
            // 비동기 리포트 생성 스레드에서 LazyInit 방지: project·session·user 동시 fetch
            softly.assertThat(attributePathsOf(
                            "io.secureai.backend.domain.report.repository.ReportRepository",
                            "findWithAssociationsById", java.util.UUID.class))
                    .as("ReportRepository.findWithAssociationsById의 @EntityGraph 경로")
                    .containsExactlyInAnyOrder("project", "session", "user");

            // 팀 멤버 목록 조회 시 user와 user.plan 동시 fetch (플랜 표시용)
            softly.assertThat(attributePathsOf(
                            "io.secureai.backend.domain.project.repository.TeamMemberRepository",
                            "findByProjectId", java.util.UUID.class))
                    .as("TeamMemberRepository.findByProjectId의 @EntityGraph 경로")
                    .containsExactlyInAnyOrder("user", "user.plan");

            // 단건 프로젝트 조회 시 owner 즉시 fetch
            softly.assertThat(attributePathsOf(
                            "io.secureai.backend.domain.project.repository.ProjectRepository",
                            "findById", java.util.UUID.class))
                    .as("ProjectRepository.findById의 @EntityGraph 경로")
                    .contains("owner");
        });
    }

    private static String[] attributePathsOf(String className, String methodName, Class<?>... paramTypes) {
        Class<?> clazz;
        Method method;
        try {
            clazz = Class.forName(className);
            method = clazz.getMethod(methodName, paramTypes);
        } catch (ClassNotFoundException | NoSuchMethodException e) {
            throw new IllegalStateException(
                    "리포지토리 메서드를 찾을 수 없습니다: " + className + "#" + methodName, e);
        }
        EntityGraph graph = method.getAnnotation(EntityGraph.class);
        assertThat(graph)
                .as("@EntityGraph가 %s#%s 에 없습니다", clazz.getSimpleName(), methodName)
                .isNotNull();
        return graph.attributePaths();
    }
}
