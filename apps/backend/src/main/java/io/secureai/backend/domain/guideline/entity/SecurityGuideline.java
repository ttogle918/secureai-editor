package io.secureai.backend.domain.guideline.entity;

// import io.secureai.backend.global.entity.BaseTimeEntity;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "security_guidelines", uniqueConstraints = {
        @UniqueConstraint(name = "uq_guideline_title_stack", columnNames = { "title", "target_stack" })
})
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
// public class SecurityGuideline extends BaseTimeEntity {
public class SecurityGuideline {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 50)
    private String category;

    @Column(length = 50)
    private String subCategory;

    @Column(name = "target_stack", nullable = false, length = 50)
    private String targetStack;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String content;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "JSONB")
    private Map<String, Object> metadata;

    @Column(length = 500)
    private String sourcePath;
}
