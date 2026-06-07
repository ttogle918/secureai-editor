package io.secureai.backend.domain.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OneToOne;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestFactory;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.type.filter.AnnotationTypeFilter;

import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * JPA 엔티티 매핑의 <b>설계 불변식</b>을 리플렉션으로 검증한다.
 * 실제 DB/Spring 컨텍스트 없이 순수 단위 테스트로 동작하며,
 * 클래스패스를 스캔해 새로 추가되는 엔티티에도 자동으로 규칙을 적용한다.
 *
 * <p>검증하는 불변식:
 * <ul>
 *   <li>{@code @ManyToOne}·{@code @OneToOne} 연관은 반드시 {@code FetchType.LAZY}
 *       — EAGER는 의도치 않은 즉시 로딩/N+1을 유발하는 JPA 최대의 성능 함정.</li>
 *   <li>{@code @OneToMany}·{@code @ManyToMany} 컬렉션은 EAGER가 아니어야 한다
 *       (EAGER 컬렉션은 카테시안 곱·MultipleBagFetchException 위험).</li>
 *   <li>모든 {@code @Entity}는 no-arg 생성자를 가져야 한다 (JPA 프록시/인스턴스화 요구사항).</li>
 * </ul>
 */
class EntityMappingTest {

    private static final String BASE_PACKAGE = "io.secureai.backend";

    /** 클래스패스를 스캔해 @Entity 클래스를 모두 찾는다. */
    private static List<Class<?>> findEntityClasses() {
        var provider = new ClassPathScanningCandidateComponentProvider(false);
        provider.addIncludeFilter(new AnnotationTypeFilter(Entity.class));

        List<Class<?>> entities = new ArrayList<>();
        for (BeanDefinition def : provider.findCandidateComponents(BASE_PACKAGE)) {
            try {
                entities.add(Class.forName(def.getBeanClassName()));
            } catch (ClassNotFoundException e) {
                throw new IllegalStateException("엔티티 클래스 로드 실패: " + def.getBeanClassName(), e);
            }
        }
        entities.sort(Comparator.comparing(Class::getName));
        return entities;
    }

    /** @MappedSuperclass 상속 필드까지 포함해 선언 필드를 모두 수집한다. */
    private static List<Field> allFields(Class<?> type) {
        List<Field> fields = new ArrayList<>();
        for (Class<?> c = type; c != null && c != Object.class; c = c.getSuperclass()) {
            fields.addAll(Arrays.asList(c.getDeclaredFields()));
        }
        return fields;
    }

    @Test
    @DisplayName("스캐너 정상 동작 — @Entity 클래스를 하나 이상 발견한다")
    void scanner_findsEntities() {
        assertThat(findEntityClasses())
                .as("io.secureai.backend 패키지에서 @Entity 클래스를 찾지 못했습니다")
                .isNotEmpty();
    }

    @TestFactory
    @DisplayName("@ManyToOne·@OneToOne 연관은 반드시 LAZY 페치여야 한다")
    List<DynamicTest> toOneAssociationsMustBeLazy() {
        List<DynamicTest> tests = new ArrayList<>();
        for (Class<?> entity : findEntityClasses()) {
            for (Field field : allFields(entity)) {
                FetchType fetch = null;
                String kind = null;
                if (field.isAnnotationPresent(ManyToOne.class)) {
                    fetch = field.getAnnotation(ManyToOne.class).fetch();
                    kind = "@ManyToOne";
                } else if (field.isAnnotationPresent(OneToOne.class)) {
                    fetch = field.getAnnotation(OneToOne.class).fetch();
                    kind = "@OneToOne";
                }
                if (fetch != null) {
                    final FetchType actual = fetch;
                    final String k = kind;
                    tests.add(DynamicTest.dynamicTest(
                            entity.getSimpleName() + "." + field.getName(),
                            () -> assertThat(actual)
                                    .as("%s %s.%s 는 LAZY여야 합니다 — EAGER는 즉시 로딩/N+1을 유발합니다",
                                            k, entity.getSimpleName(), field.getName())
                                    .isEqualTo(FetchType.LAZY)));
                }
            }
        }
        return tests;
    }

    @TestFactory
    @DisplayName("@OneToMany·@ManyToMany 컬렉션은 EAGER가 아니어야 한다")
    List<DynamicTest> toManyCollectionsMustNotBeEager() {
        List<DynamicTest> tests = new ArrayList<>();
        for (Class<?> entity : findEntityClasses()) {
            for (Field field : allFields(entity)) {
                FetchType fetch = null;
                String kind = null;
                if (field.isAnnotationPresent(OneToMany.class)) {
                    fetch = field.getAnnotation(OneToMany.class).fetch();
                    kind = "@OneToMany";
                } else if (field.isAnnotationPresent(ManyToMany.class)) {
                    fetch = field.getAnnotation(ManyToMany.class).fetch();
                    kind = "@ManyToMany";
                }
                if (fetch != null) {
                    final FetchType actual = fetch;
                    final String k = kind;
                    tests.add(DynamicTest.dynamicTest(
                            entity.getSimpleName() + "." + field.getName(),
                            () -> assertThat(actual)
                                    .as("%s %s.%s 는 EAGER가 아니어야 합니다 "
                                            + "(카테시안 곱·MultipleBagFetchException 위험)",
                                            k, entity.getSimpleName(), field.getName())
                                    .isNotEqualTo(FetchType.EAGER)));
                }
            }
        }
        return tests;
    }

    @TestFactory
    @DisplayName("모든 @Entity는 no-arg 생성자를 가져야 한다 (JPA 요구사항)")
    List<DynamicTest> entitiesMustHaveNoArgConstructor() {
        List<DynamicTest> tests = new ArrayList<>();
        for (Class<?> entity : findEntityClasses()) {
            tests.add(DynamicTest.dynamicTest(entity.getSimpleName(), () -> {
                boolean hasNoArg = Arrays.stream(entity.getDeclaredConstructors())
                        .anyMatch(c -> c.getParameterCount() == 0);
                assertThat(hasNoArg)
                        .as("@Entity %s 에 no-arg 생성자가 없습니다 — "
                                + "JPA가 인스턴스화/프록시 생성에 실패합니다", entity.getSimpleName())
                        .isTrue();
            }));
        }
        return tests;
    }

    @Test
    @DisplayName("문서화된 N+1 방지 컬렉션 계약 — Project.teamMembers는 @BatchSize(>0)를 유지한다")
    void projectTeamMembers_retainsBatchSize() throws Exception {
        Field field = Class.forName("io.secureai.backend.domain.project.entity.Project")
                .getDeclaredField("teamMembers");
        var batchSize = field.getAnnotation(org.hibernate.annotations.BatchSize.class);

        assertThat(batchSize)
                .as("Project.teamMembers에 @BatchSize가 없습니다 — 목록 조회 시 N+1이 발생합니다")
                .isNotNull();
        assertThat(batchSize.size()).as("@BatchSize.size는 0보다 커야 합니다").isGreaterThan(0);
    }
}
